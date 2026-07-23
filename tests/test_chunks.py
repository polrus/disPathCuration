import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from dispathcuration.chunks import build_chunks, token_idf


def _surface(rows):
    return pl.DataFrame(
        rows,
        schema=[
            ("diseaseId", pl.String),
            ("diseaseName", pl.String),
            ("source", pl.String),
            ("isAbbreviation", pl.Boolean),
            ("normalised", pl.String),
        ],
        orient="row",
    )


def _index():
    surface = _surface(
        [
            ("D1", "hyperargininemia", "name", False, "hyperargininemia"),
            ("D1", "arginase deficiency", "exact_synonym", False, "arginase deficiency"),
            ("D2", "death by undetermined cause", "name", False, "death by undetermined cause"),
            ("D3", "type 2 diabetes mellitus", "name", False, "type 2 diabetes mellitus"),
            ("D4", "Pendred syndrome", "name", False, "pendred syndrome"),
            ("D4", "PDS", "exact_synonym", True, "pds"),
        ]
    )
    idf = token_idf(surface)
    return build_chunks(surface, idf), idf


class TestCoverageSeparatesNameFromFragment:
    """The defect that motivated coverage: a whole name and an incidental
    fragment can share identical specificity, and only coverage tells them
    apart."""

    def test_whole_name_covers_fully(self):
        chunks, _ = _index()
        row = chunks.filter(pl.col("chunk") == "hyperargininemia")
        assert row["coverage"].item() == 1.0

    def test_fragment_covers_partially(self):
        chunks, _ = _index()
        cause = chunks.filter(
            (pl.col("chunk") == "cause") & (pl.col("diseaseId") == "D2")
        )
        assert cause["coverage"].item() < 0.6


class TestChunkGeneration:
    def test_generic_only_chunk_excluded(self):
        # "type" alone carries no identity and must not be indexed.
        chunks, _ = _index()
        assert chunks.filter(pl.col("chunk") == "type").height == 0

    def test_specific_substring_kept(self):
        chunks, _ = _index()
        assert chunks.filter(pl.col("chunk") == "diabetes mellitus").height == 1

    def test_abbreviation_kept_atomic(self):
        chunks, _ = _index()
        pds = chunks.filter(pl.col("diseaseId") == "D4").filter(
            pl.col("isAbbreviation")
        )
        assert pds["chunk"].to_list() == ["pds"]

    def test_ambiguity_counted(self):
        chunks, _ = _index()
        # "diabetes" appears in one disease here.
        row = chunks.filter(pl.col("chunk") == "diabetes")
        assert row["nDiseases"].unique().to_list() == [1]
