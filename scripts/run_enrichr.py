"""Extract disease pathways from Enrichr pathway libraries.

Usage:  python scripts/run_enrichr.py [--library NAME ...]
Default: all curated pathway libraries (enrichr.PATHWAY_LIBRARIES).

Writes, per library and combined, to data/enrichr/:
  matches_<library>.csv          disease-pathway matches for one library
  enrichr_matches_all.csv        all libraries, with a `library` column
  enrichr_target_disease_all.csv target-disease pairs (term genes x disease)

Reuses the disease chunk index and the matcher (templates off; Enrichr labels do
not use the Reactome "causes" convention). The judge is a separate later step.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from dispathcuration.config import DATA_DIR  # noqa: E402
from dispathcuration.diseases import gene_symbols, load_diseases  # noqa: E402
from dispathcuration.enrichr import (  # noqa: E402
    ENRICHR_DIR,
    PATHWAY_LIBRARIES,
    load_library,
    term_genes,
)
from dispathcuration.matcher import build_matcher  # noqa: E402
from dispathcuration.output import add_matched_synonym  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--library", action="append", help="library name; repeatable")
    args = parser.parse_args()
    libraries = args.library or PATHWAY_LIBRARIES

    chunks = pl.read_parquet(DATA_DIR / "disease_chunks.parquet")
    surface_forms = pl.read_parquet(DATA_DIR / "disease_surface_forms.parquet")
    diseases = load_diseases()
    disease_names = dict(zip(diseases["id"], diseases["name"], strict=True))
    matcher = build_matcher(chunks, gene_symbols(), use_templates=False)

    ENRICHR_DIR.mkdir(parents=True, exist_ok=True)
    all_matches = []
    all_td = []
    print(f"{'library':30s} {'terms':>7} {'matches':>8} {'diseases':>9} {'tgt-dis':>8}")
    for library in libraries:
        frame = load_library(library)
        matches = add_matched_synonym(matcher.match_all(frame), surface_forms)
        matches = matches.with_columns(
            pl.lit(library).alias("library"),
            pl.col("diseaseId").replace_strict(disease_names, default="").alias("diseaseName"),
        )
        matches.write_csv(ENRICHR_DIR / f"matches_{library}.csv")

        # Target-disease expansion via this library's gene sets.
        genes = term_genes(frame)
        td = set()
        for pid, did in zip(matches["pathwayId"], matches["diseaseId"], strict=True):
            for gene in genes.get(pid, ()):  # pid == term
                td.add((library, gene, did))

        print(
            f"{library:30s} {frame.height:7d} {matches.height:8d} "
            f"{matches['diseaseId'].n_unique():9d} {len(td):8d}"
        )
        all_matches.append(matches)
        all_td.extend(td)

    combined = pl.concat(all_matches, how="diagonal_relaxed")
    combined.write_csv(ENRICHR_DIR / "enrichr_matches_all.csv")
    pl.DataFrame(
        all_td, schema=["library", "targetSymbol", "diseaseId"], orient="row"
    ).unique().write_csv(ENRICHR_DIR / "enrichr_target_disease_all.csv")

    print(
        f"\ntotal: {combined.height} matches across {len(libraries)} libraries, "
        f"{combined['diseaseId'].n_unique()} distinct diseases, "
        f"{len(set(all_td))} target-disease rows"
    )
    print("wrote enrichr_matches_all.csv and enrichr_target_disease_all.csv")


if __name__ == "__main__":
    main()
