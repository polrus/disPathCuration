"""Judge the Enrichr disease-pathway candidates with the LLM judge.

Usage:  python scripts/run_enrichr_judge.py [--model sonnet|haiku|opus]
Reads:  data/enrichr/enrichr_matches_all.csv, data/26.06/disease_chunks.parquet
Writes: data/enrichr/enrichr_matches_judged_all.csv (adds verdict + reason)
        data/enrichr/judge_cache.json

Only the low-confidence tier (alias and low-specificity whole_form) is judged;
the rest is auto-kept. Same annotating-layer semantics as the Open Targets judge.
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
from dispathcuration.enrichr import ENRICHR_DIR  # noqa: E402
from dispathcuration.judge import (  # noqa: E402
    DEFAULT_MODEL,
    judge_matches,
    select_low_confidence,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=DEFAULT_MODEL, help="sonnet (default), haiku, opus")
    args = parser.parse_args()

    matches = pl.read_csv(ENRICHR_DIR / "enrichr_matches_all.csv")
    chunks = pl.read_parquet(DATA_DIR / "disease_chunks.parquet")
    diseases = load_diseases()
    disease_names = dict(zip(diseases["id"], diseases["name"], strict=True))

    candidates = select_low_confidence(matches, chunks)
    print(f"low-confidence candidates to judge: {candidates.height} of {matches.height}")

    cache_path = ENRICHR_DIR / "judge_cache.json"
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    before = len(cache)
    judged = judge_matches(candidates, disease_names, model=args.model, cache=cache)
    cache_path.write_text(json.dumps(cache))
    print(f"judged {len(cache) - before} new pairs ({len(cache)} cached total)")

    # Auto-keep the high-confidence tier (template n/a here; high-spec whole_form).
    judged_keys = set(
        zip(judged["pathwayId"], judged["diseaseId"], judged["matchedText"],
            judged["library"], strict=True)
    )
    high = matches.filter(
        ~pl.struct("pathwayId", "diseaseId", "matchedText", "library").map_elements(
            lambda s: (s["pathwayId"], s["diseaseId"], s["matchedText"], s["library"])
            in judged_keys,
            return_dtype=pl.Boolean,
        )
    ).with_columns(
        pl.lit("keep").alias("verdict"),
        pl.lit("high-confidence tier, not judged").alias("reason"),
    )

    full = pl.concat([high, judged.select(high.columns)], how="vertical")
    full.write_csv(ENRICHR_DIR / "enrichr_matches_judged_all.csv")
    for library in matches["library"].unique().sort():
        full.filter(pl.col("library") == library).write_csv(
            ENRICHR_DIR / f"judged_{library}.csv"
        )

    print("\nverdicts:")
    print(full["verdict"].value_counts(sort=True))
    print("\nby library (kept / rejected):")
    summary = (
        full.group_by("library", "verdict").len()
        .pivot("verdict", index="library", values="len")
        .fill_null(0).sort("library")
    )
    print(summary)
    print("\nwrote enrichr_matches_judged_all.csv and per-library judged_*.csv")


if __name__ == "__main__":
    main()
