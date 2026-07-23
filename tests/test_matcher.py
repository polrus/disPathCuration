"""Matcher tests.

Two layers:
- Unit tests on small synthetic fixtures, always run, pinning the logic of each
  extractor.
- A recovery-consistency test on the real disease index, run only when the
  cached parquet files are present. It asserts that a curated set of pathway
  labels which contain a disease name still resolve to the right disease, and
  that known traps (biology tokens, ambiguous acronyms) still do not. This is
  the regression guard for the recovery numbers.
"""

import sys
from pathlib import Path

import polars as pl
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from dispathcuration.config import DATA_DIR  # noqa: E402
from dispathcuration.matcher import (  # noqa: E402
    Matcher,
    build_alias_index,
    build_slot_index,
    build_whole_form_index,
    disease_slot,
    resolve_slot,
)


# --------------------------------------------------------------------------- #
# Synthetic fixtures
# --------------------------------------------------------------------------- #


def _chunks(rows):
    return pl.DataFrame(
        rows,
        schema=[
            ("chunk", pl.String),
            ("diseaseId", pl.String),
            ("isAbbreviation", pl.Boolean),
            ("coverage", pl.Float64),
            ("nTokens", pl.Int32),
            ("specificity", pl.Float64),
            ("nDiseases", pl.UInt32),
        ],
        orient="row",
    )


class TestTemplateSlot:
    def test_defective_gene_causes(self):
        assert disease_slot("Defective ABCC6 causes PXE") == "pxe"

    def test_variants_cause(self):
        assert disease_slot("ARG1 variants cause hyperargininemia") == "hyperargininemia"

    def test_non_template_returns_none(self):
        assert disease_slot("Signaling by FGFR in disease") is None

    def test_spelled_out_name_beats_ambiguous_acronym(self):
        # "Pendred syndrome (PDS)": the full name resolves to one disease,
        # the acronym to two. The full name must win.
        index = {"pendred syndrome": frozenset({"D1"}), "pds": frozenset({"D1", "D2"})}
        slot = disease_slot("Defective SLC26A4 causes Pendred syndrome (PDS)")
        form, ids = resolve_slot(slot, index)
        assert form == "pendred syndrome"
        assert ids == frozenset({"D1"})


class TestWholeFormIndex:
    def test_fragment_excluded(self):
        chunks = _chunks(
            [
                ("diabetes mellitus", "D1", False, 0.30, 2, 11.7, 41),
                ("type 2 diabetes mellitus", "D1", False, 1.0, 4, 16.8, 1),
            ]
        )
        index = build_whole_form_index(chunks)
        assert "diabetes mellitus" not in index  # coverage 0.30
        assert "type 2 diabetes mellitus" in index

    def test_generic_single_word_excluded(self):
        chunks = _chunks(
            [
                ("fibrosis", "D1", False, 1.0, 1, 6.0, 54),  # below single-token floor
                ("hyperargininemia", "D2", False, 1.0, 1, 9.3, 2),
            ]
        )
        index = build_whole_form_index(chunks)
        assert "fibrosis" not in index
        assert "hyperargininemia" in index


class TestAliasIndex:
    def test_generic_word_excluded_by_sharing(self):
        chunks = _chunks(
            [
                ("cancer", "D1", False, 1.0, 1, 3.7, 521),  # shared too widely
                ("influenza", "D2", False, 1.0, 1, 9.0, 2),
            ]
        )
        index = build_alias_index(chunks, gene_symbols=set())
        assert "cancer" not in index
        assert "influenza" in index

    def test_gene_symbol_excluded(self):
        chunks = _chunks([("kit", "D1", False, 1.0, 1, 8.0, 3)])
        index = build_alias_index(chunks, gene_symbols={"kit"})
        assert "kit" not in index

    def test_short_token_needs_allowlist(self):
        chunks = _chunks(
            [
                ("abc", "D1", False, 1.0, 1, 8.0, 2),   # short, not allow-listed
                ("cdg", "D2", False, 1.0, 1, 8.0, 2),
            ]
        )
        index = build_alias_index(chunks, gene_symbols=set())
        assert "abc" not in index
        assert "cdg" not in index

    def test_allowlist_injected(self):
        index = build_alias_index(_chunks([]), gene_symbols=set())
        assert index["hiv"] == frozenset({"MONDO_0005109"})


class TestPrecedence:
    def test_template_beats_alias_on_same_disease(self):
        chunks = _chunks(
            [("sialidosis", "D1", False, 1.0, 1, 10.0, 1)]
        )
        matcher = Matcher(
            build_whole_form_index(chunks),
            build_slot_index(chunks),
            build_alias_index(chunks, gene_symbols=set()),
        )
        matches = matcher.match_label("p", "Defective NEU1 causes sialidosis")
        assert len(matches) == 1
        assert matches[0].method == "template"


# --------------------------------------------------------------------------- #
# Recovery consistency on the real index
# --------------------------------------------------------------------------- #

_CACHE = DATA_DIR / "disease_chunks.parquet"

# Each label contains a disease; the matcher must resolve it to this EFO/MONDO id.
RECOVERABLE = {
    "Defective SLC2A10 causes arterial tortuosity syndrome (ATS)": "MONDO_0008818",
    "Defective NEU1 causes sialidosis": "MONDO_0017734",
    "Uncoating of the HIV Virion": "MONDO_0005109",
    "SARS-CoV-1-host interactions": "MONDO_0005091",
    "TRAF3 deficiency - HSE": "MONDO_0012521",
}

# Each label must NOT yield the trap disease: a biology token or an acronym that
# collides with an unrelated disease.
TRAPS = {
    "Constitutive Signaling by NOTCH1 HD Domain Mutants": "Huntington",  # HD
    "ABC transporter disorders": None,   # abc, biology
    "Biosynthesis of DHA-derived SPMs": None,   # spms, biology
    "Cell Cycle": None,   # process term, excluded
    "Surfactant metabolism": None,   # metabolic process, excluded
}


@pytest.fixture(scope="module")
def matcher():
    from dispathcuration.diseases import gene_symbols
    from dispathcuration.matcher import build_matcher

    return build_matcher(pl.read_parquet(_CACHE), gene_symbols())


@pytest.mark.skipif(not _CACHE.exists(), reason="disease index not built")
class TestRecoveryConsistency:
    @pytest.mark.parametrize("label,disease_id", RECOVERABLE.items())
    def test_recoverable_resolves(self, matcher, label, disease_id):
        found = {m.diseaseId for m in matcher.match_label("p", label)}
        assert disease_id in found, f"{label!r} did not recover {disease_id}"

    @pytest.mark.parametrize("label", TRAPS)
    def test_traps_not_matched(self, matcher, label):
        names = {m.matchedText for m in matcher.match_label("p", label)}
        # No biology token should have produced any match for these labels.
        assert not names, f"{label!r} produced unexpected matches {names}"
