"""Run the matcher over a label source and report results.

Usage:  python scripts/run_matcher.py [--source reactome|go]
Writes: data/<release>/matches_<source>.parquet and .csv, plus, when the source
        has a curated baseline, new_candidates_<source>.csv and
        specificity_fixes_<source>.csv.

Reactome is evaluated against evidence_reactome. GO has no disease baseline, so
every GO match is reported as a candidate and no recovery is computed.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from dispathcuration.config import DATA_DIR  # noqa: E402
from dispathcuration.data import fetch  # noqa: E402
from dispathcuration.diseases import gene_symbols, load_diseases  # noqa: E402
from dispathcuration.evaluate import (  # noqa: E402
    evidence_pairs,
    novelty_report,
    recovery_report,
    specificity_fix_table,
)
from dispathcuration.matcher import build_matcher  # noqa: E402
from dispathcuration.sources import get_source  # noqa: E402


def _evaluate(matches, source, diseases):
    """Reactome-style evaluation against a curated baseline."""
    evidence = fetch(source.evidence_dataset)

    report = recovery_report(matches, evidence, diseases)
    c = report["counts"]
    print("\n=== recovery of curated evidence ===")
    print(f"curated pairs          : {c['total_evidence_pairs']}")
    print(f"  recovered            : {c['recovered']} "
          f"({100 * c['recovered'] / c['total_evidence_pairs']:.1f}%)")
    print(f"    exact same disease : {c['exact']}")
    print(f"    more specific      : {c['more_specific']}  (matcher adds specificity)")
    print(f"    more general       : {c['more_general']}")
    print(f"  not recovered        : {c['not_recovered']}")

    novelty = novelty_report(matches, evidence)
    print("\n=== new candidate pairs (absent from evidence) ===")
    print(f"new pairs              : {novelty['new_pairs']}")
    print(novelty["by_method"])

    pairs = evidence_pairs(evidence)
    curated = set(zip(pairs["pathwayId"], pairs["diseaseId"], strict=True))
    is_new = pl.struct("pathwayId", "diseaseId").map_elements(
        lambda s: (s["pathwayId"], s["diseaseId"]) not in curated, return_dtype=pl.Boolean
    )
    return is_new, specificity_fix_table(matches, evidence, diseases)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="reactome", help="reactome (default) or go")
    args = parser.parse_args()
    source = get_source(args.source)

    chunks = pl.read_parquet(DATA_DIR / "disease_chunks.parquet")
    diseases = load_diseases()
    disease_names = dict(zip(diseases["id"], diseases["name"], strict=True))

    labels = source.load_labels()
    matcher = build_matcher(chunks, gene_symbols(), use_templates=source.use_templates)
    matches = matcher.match_all(labels)
    matches.write_parquet(DATA_DIR / f"matches_{source.name}.parquet")

    print(f"=== matcher output ({source.name}) ===")
    print(f"labels matched over    : {labels.height}")
    print(f"pathway-disease pairs  : {matches.height}")
    print(f"distinct pathways      : {matches['pathwayId'].n_unique()}")
    print(f"distinct diseases      : {matches['diseaseId'].n_unique()}")
    print("by method:")
    print(matches["method"].value_counts(sort=True))

    labelled = matches.with_columns(
        pl.col("diseaseId").replace_strict(disease_names, default="").alias("diseaseName")
    )

    if source.evidence_dataset is not None:
        is_new, fixes = _evaluate(matches, source, diseases)
        labelled.write_csv(DATA_DIR / f"matches_{source.name}.csv")
        labelled.filter(is_new).write_csv(DATA_DIR / f"new_candidates_{source.name}.csv")
        fixes.write_csv(DATA_DIR / f"specificity_fixes_{source.name}.csv")
        print(
            f"\nwrote CSV: matches_{source.name}.csv, "
            f"new_candidates_{source.name}.csv, specificity_fixes_{source.name}.csv"
        )
    else:
        # No curated baseline: every match is a candidate.
        print(
            "\n(no curated disease baseline for this source; "
            "all matches are candidates, no recovery computed)"
        )
        labelled.write_csv(DATA_DIR / f"matches_{source.name}.csv")
        labelled.write_csv(DATA_DIR / f"new_candidates_{source.name}.csv")
        print(
            f"\nwrote CSV: matches_{source.name}.csv, new_candidates_{source.name}.csv"
        )


if __name__ == "__main__":
    main()
