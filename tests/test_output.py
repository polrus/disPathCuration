import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from dispathcuration.output import add_matched_synonym, combine_sources


def test_matched_synonym_recovers_raw_surface_form():
    matches = pl.DataFrame(
        {"diseaseId": ["D1"], "matchedText": ["type 1 hypersensitivity"]}
    )
    surface = pl.DataFrame(
        {
            "diseaseId": ["D1", "D1"],
            "normalised": ["type 1 hypersensitivity", "ige responsiveness atopic"],
            "raw": ["type I hypersensitivity", "IgE responsiveness, atopic"],
        }
    )
    out = add_matched_synonym(matches, surface)
    assert out["matchedSynonym"].to_list() == ["type I hypersensitivity"]


def test_matched_synonym_falls_back_to_matched_text():
    matches = pl.DataFrame({"diseaseId": ["D9"], "matchedText": ["hiv"]})
    surface = pl.DataFrame(
        {"diseaseId": ["D1"], "normalised": ["asthma"], "raw": ["asthma"]}
    )
    out = add_matched_synonym(matches, surface)
    assert out["matchedSynonym"].to_list() == ["hiv"]


def test_combine_sources_tags_and_orders():
    a = pl.DataFrame({"diseaseId": ["D1"], "verdict": ["keep"]})
    b = pl.DataFrame({"diseaseId": ["D2"], "verdict": ["reject"]})
    combined = combine_sources({"reactome": a, "go": b}, release="26.06")
    assert combined.columns[0] == "source"
    assert set(combined["source"]) == {"Reactome_26.06", "GO_26.06"}
    assert combined.height == 2
