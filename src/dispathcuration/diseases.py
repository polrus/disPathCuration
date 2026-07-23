"""Build the disease surface form table from the Open Targets disease dataset."""

from __future__ import annotations

import polars as pl

from .config import MEASUREMENT_AREA, PROCESS_AREA
from .data import fetch
from .normalise import is_abbreviation, normalise


def load_diseases(
    drop_measurements: bool = True, drop_processes: bool = True
) -> pl.DataFrame:
    """Load the disease dataset, excluding non-disease terms by default.

    The dataset carries the whole of EFO. Two branches are not diseases and are
    removed so they cannot become match targets:

    - measurement (53% of rows): GWAS traits such as "Increased circulating
      ACTH level", whose vocabulary (level, serum, ratio) would dominate the
      index.
    - biological_process (735 rows): "cell cycle", "metabolic process",
      "transport", which match pathway labels freely for the wrong reason.
    """
    diseases = fetch("disease")
    if drop_measurements:
        diseases = diseases.filter(
            ~pl.col("therapeuticAreas").list.contains(MEASUREMENT_AREA)
        )
    if drop_processes:
        diseases = diseases.filter(
            ~pl.col("therapeuticAreas").list.contains(PROCESS_AREA)
        )
    return diseases


def gene_symbols() -> set[str]:
    """Return approved gene symbols, lowercased.

    Used to reject distinctive-token aliases that are really gene symbols
    (`AMN`, `KIT`, `FLT3`), the main source of spurious acronym matches.
    """
    symbols = fetch("target", columns=["approvedSymbol"])
    return set(symbols["approvedSymbol"].str.to_lowercase().to_list())


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
