"""Build the disease surface form table from the Open Targets disease dataset."""

from __future__ import annotations

import polars as pl

from .config import MEASUREMENT_AREA
from .data import fetch
from .normalise import is_abbreviation, normalise


def load_diseases(drop_measurements: bool = True) -> pl.DataFrame:
    """Load the disease dataset, excluding measurement terms by default.

    The dataset carries the whole of EFO, and 53% of its rows sit under the
    measurement therapeutic area: GWAS traits such as "Increased circulating
    ACTH level". They are not diseases, and their vocabulary (level, serum,
    protein, ratio) would dominate any index built over the raw table.
    """
    diseases = fetch("disease")
    if drop_measurements:
        diseases = diseases.filter(
            ~pl.col("therapeuticAreas").list.contains(MEASUREMENT_AREA)
        )
    return diseases


def surface_forms(diseases: pl.DataFrame) -> pl.DataFrame:
    """Expand each disease into its distinct searchable surface forms.

    Only the primary name and exact synonyms are used. Narrow, broad and
    related synonyms are held back: broad and related synonyms in particular
    include loosely associated terms and are the main source of false matches.

    Returns one row per (diseaseId, surface form) with the normalised form and
    an abbreviation flag. Abbreviations are kept verbatim in `raw` because they
    have to be matched case sensitively downstream.
    """
    frame = diseases.select(
        pl.col("id").alias("diseaseId"),
        pl.col("name").alias("diseaseName"),
        pl.col("name").alias("raw"),
        pl.lit("name").alias("source"),
    )

    synonyms = (
        diseases.select(
            pl.col("id").alias("diseaseId"),
            pl.col("name").alias("diseaseName"),
            pl.col("exactSynonyms").alias("raw"),
            pl.lit("exact_synonym").alias("source"),
        )
        .explode("raw")
        .drop_nulls("raw")
    )

    combined = pl.concat([frame, synonyms])

    return (
        combined.with_columns(
            pl.col("raw")
            .map_elements(is_abbreviation, return_dtype=pl.Boolean)
            .alias("isAbbreviation"),
            pl.col("raw")
            .map_elements(normalise, return_dtype=pl.String)
            .alias("normalised"),
        )
        .filter(pl.col("normalised").str.len_chars() > 0)
        # A disease may repeat a spelling between its name and its synonyms.
        .unique(subset=["diseaseId", "normalised"], keep="first")
        .sort("diseaseId", "source")
    )
