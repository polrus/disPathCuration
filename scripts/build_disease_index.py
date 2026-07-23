"""Build the disease chunk index and report its shape.

Usage:  python scripts/build_disease_index.py
Writes: data/<release>/disease_surface_forms.parquet
        data/<release>/disease_chunks.parquet
"""

from __future__ import annotations

import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from dispathcuration.chunks import build_chunks, token_idf  # noqa: E402
from dispathcuration.config import DATA_DIR  # noqa: E402
from dispathcuration.diseases import load_diseases, surface_forms  # noqa: E402


def main() -> None:
    raw = load_diseases(drop_measurements=False)
    diseases = load_diseases()
    print(f"diseases: {diseases.height} of {raw.height} after dropping measurements")

    surface = surface_forms(diseases)
    print(
        f"surface forms: {surface.height} "
        f"({surface.filter(pl.col('isAbbreviation')).height} abbreviations)"
    )

    idf = token_idf(surface)
    chunks = build_chunks(surface, idf)
    print(f"chunks: {chunks.height} ({chunks['chunk'].n_unique()} distinct)")

    surface.write_parquet(DATA_DIR / "disease_surface_forms.parquet")
    chunks.write_parquet(DATA_DIR / "disease_chunks.parquet")

    print("\nleast specific chunks (would match everything):")
    print(
        chunks.unique(subset=["chunk"])
        .sort("specificity")
        .select("chunk", "specificity", "nDiseases")
        .head(8)
    )

    print("\nspecificity quantiles over distinct chunks:")
    distinct = chunks.unique(subset=["chunk"])["specificity"]
    for q in (0.05, 0.25, 0.5, 0.75, 0.95):
        print(f"  p{int(q * 100):02d}  {distinct.quantile(q):6.2f}")


if __name__ == "__main__":
    main()
