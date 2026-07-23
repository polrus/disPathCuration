"""Run the matcher over Reactome labels and report recovery against evidence.

Usage:  python scripts/run_matcher.py
Writes: data/<release>/matches.parquet
"""

from __future__ import annotations

import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from dispathcuration.config import DATA_DIR  # noqa: E402
from dispathcuration.data import fetch  # noqa: E402
from dispathcuration.diseases import gene_symbols, load_diseases  # noqa: E402
from dispathcuration.evaluate import novelty_report, recovery_report  # noqa: E402
from dispathcuration.matcher import build_matcher  # noqa: E402


def main() -> None:
    chunks = pl.read_parquet(DATA_DIR / "disease_chunks.parquet")
    reactome = fetch("reactome")
    evidence = fetch("evidence_reactome")
    diseases = load_diseases()

    matcher = build_matcher(chunks, gene_symbols())
    matches = matcher.match_all(reactome)
    matches.write_parquet(DATA_DIR / "matches.parquet")

    print("=== matcher output ===")
    print(f"pathway-disease pairs : {matches.height}")
    print(f"distinct pathways     : {matches['pathwayId'].n_unique()}")
    print(f"distinct diseases     : {matches['diseaseId'].n_unique()}")
    print("by method:")
    print(matches["method"].value_counts(sort=True))

    report = recovery_report(matches, evidence, diseases)
    c = report["counts"]
    print("\n=== recovery of curated Reactome evidence ===")
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


if __name__ == "__main__":
    main()
