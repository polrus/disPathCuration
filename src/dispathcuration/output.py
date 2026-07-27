"""Helpers for enriching and combining pipeline outputs.

`add_matched_synonym` explains a match: it maps the normalised matched text back
to the original disease surface form that fired, so a reviewer sees that
"type I hypersensitivity" matched the disease "IgE responsiveness, atopic" via
its synonym, not by magic.

`combine_sources` merges the per-source result tables into one, tagging each row
with a `source` column, so Reactome and GO candidates sit in a single file.
"""

from __future__ import annotations

import polars as pl

from .config import RELEASE


def add_matched_synonym(
    matches: pl.DataFrame, surface_forms: pl.DataFrame
) -> pl.DataFrame:
    """Add a `matchedSynonym` column: the original disease surface form that
    matched, recovered from the normalised matched text.

    The matcher stores `matchedText` normalised (casefolded, Roman numerals
    resolved). This looks up the raw surface form of that disease whose
    normalised value equals the matched text. Falls back to the matched text
    itself for alias tokens that are not a full surface form.
    """
    lookup: dict[tuple[str, str], str] = {}
    for disease_id, normalised, raw in zip(
        surface_forms["diseaseId"],
        surface_forms["normalised"],
        surface_forms["raw"],
        strict=True,
    ):
        lookup.setdefault((disease_id, normalised), raw)

    synonyms = [
        lookup.get((disease_id, matched), matched)
        for disease_id, matched in zip(
            matches["diseaseId"], matches["matchedText"], strict=True
        )
    ]
    return matches.with_columns(pl.Series("matchedSynonym", synonyms))


def combine_sources(
    frames: dict[str, pl.DataFrame], release: str = RELEASE
) -> pl.DataFrame:
    """Concatenate per-source result tables into one, adding a `source` column.

    The source tag is `<DisplayName>_<release>`, for example `Reactome_26.06`,
    so a unified file records which library and which platform release each row
    came from.
    """
    display = {"reactome": "Reactome", "go": "GO"}
    tagged = []
    for name, frame in frames.items():
        tag = f"{display.get(name, name)}_{release}"
        tagged.append(frame.with_columns(pl.lit(tag).alias("source")))
    combined = pl.concat(tagged, how="diagonal_relaxed")
    # Put source first for readability.
    ordered = ["source"] + [c for c in combined.columns if c != "source"]
    return combined.select(ordered)
