"""Judge the low-confidence matches with Claude Code and write CSV outputs.

Usage:  python scripts/run_judge.py [--model haiku|opus]
Reads:  data/<release>/matches.parquet, disease_chunks.parquet
Writes: data/<release>/matches_judged.parquet and .csv
        data/<release>/judge_cache.json  (so re-runs skip judged pairs)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from dispathcuration.config import DATA_DIR  # noqa: E402
from dispathcuration.diseases import load_diseases  # noqa: E402
from dispathcuration.judge import (  # noqa: E402
    DEFAULT_MODEL,
    judge_matches,
    select_low_confidence,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=DEFAULT_MODEL, help="haiku (default) or opus")
    args = parser.parse_args()

    matches = pl.read_parquet(DATA_DIR / "matches.parquet")
    chunks = pl.read_parquet(DATA_DIR / "disease_chunks.parquet")
    diseases = load_diseases()
    disease_names = dict(zip(diseases["id"], diseases["name"], strict=True))

    candidates = select_low_confidence(matches, chunks)
    print(f"low-confidence candidates to judge: {candidates.height} of {matches.height}")

    cache_path = DATA_DIR / "judge_cache.json"
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    before = len(cache)

    judged = judge_matches(candidates, disease_names, model=args.model, cache=cache)
    cache_path.write_text(json.dumps(cache))
    print(f"judged {len(cache) - before} new pairs ({len(cache)} cached total)")

    print("\nverdicts:")
    print(judged["verdict"].value_counts(sort=True))

    # High-confidence tier (template, high-spec whole_form) is auto-kept.
    judged_keys = set(
        zip(judged["pathwayId"], judged["diseaseId"], judged["matchedText"], strict=True)
    )
    high = matches.filter(
        ~pl.struct("pathwayId", "diseaseId", "matchedText").map_elements(
            lambda s: (s["pathwayId"], s["diseaseId"], s["matchedText"]) in judged_keys,
            return_dtype=pl.Boolean,
        )
    ).with_columns(
        pl.lit("keep").alias("verdict"),
        pl.lit("high-confidence tier, not judged").alias("reason"),
    )

    full = pl.concat([high, judged.select(high.columns)], how="vertical")
    full.write_parquet(DATA_DIR / "matches_judged.parquet")
    full.write_csv(DATA_DIR / "matches_judged.csv")

    kept = full.filter(pl.col("verdict") == "keep")
    rejected = full.filter(pl.col("verdict") == "reject")
    print(f"\nfinal: {kept.height} kept, {rejected.height} rejected by judge")
    if rejected.height:
        print("\nrejected examples:")
        for row in rejected.head(12).iter_rows(named=True):
            print(f'  "{row["pathwayLabel"][:44]:44s}" x {row["matchedText"]!r}: {row["reason"][:50]}')


if __name__ == "__main__":
    main()
