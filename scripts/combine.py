"""Combine judged results from all sources into one file with a source column.

Usage:  python scripts/combine.py [--sources reactome go]
Reads:  data/<release>/matches_judged_<source>.parquet
Writes: data/<release>/disease_pathways_all.parquet and .csv

The unified file carries a `source` column (Reactome_<release>, GO_<release>),
the judge `verdict`, and `matchedSynonym`, so every candidate from every library
sits in one table.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from dispathcuration.config import DATA_DIR  # noqa: E402
from dispathcuration.output import combine_sources  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sources", nargs="+", default=["reactome", "go"])
    args = parser.parse_args()

    frames = {}
    for name in args.sources:
        path = DATA_DIR / f"matches_judged_{name}.parquet"
        if not path.exists():
            raise FileNotFoundError(
                f"{path} not found; run run_matcher.py and run_judge.py --source {name} first"
            )
        frames[name] = pl.read_parquet(path)

    combined = combine_sources(frames)
    combined.write_parquet(DATA_DIR / "disease_pathways_all.parquet")
    combined.write_csv(DATA_DIR / "disease_pathways_all.csv")

    print(f"combined {combined.height} rows from {len(frames)} sources")
    print(combined.group_by("source", "verdict").len().sort("source", "verdict"))
    print("\nwrote disease_pathways_all.parquet and .csv")


if __name__ == "__main__":
    main()
