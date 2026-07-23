import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from dispathcuration.normalise import is_abbreviation, normalise


class TestNormalise:
    def test_possessive_and_bare_eponym_agree(self):
        assert normalise("Parkinson's disease") == normalise("Parkinson disease")

    def test_bare_s_words_are_not_stemmed(self):
        # 1838 EFO names carry a genuine trailing s here; it must survive.
        assert normalise("Chagas disease") == "chagas disease"
        assert normalise("infectious disease") == "infectious disease"
        assert normalise("Ehlers-Danlos syndrome") == "ehlers danlos syndrome"

    def test_greek_letters_expand(self):
        assert normalise("α-thalassemia") == "alpha thalassemia"

    def test_diacritics_stripped(self):
        assert normalise("Behçet syndrome") == "behcet syndrome"

    def test_roman_numerals_convert_after_trigger(self):
        assert normalise("diabetes type II") == "diabetes type 2"

    def test_roman_numerals_left_alone_without_trigger(self):
        # A bare "V" is far more often a gene or letter than the numeral 5.
        assert normalise("glycogen storage disease V").endswith(" v")

    def test_empty(self):
        assert normalise("") == ""


class TestIsAbbreviation:
    def test_acronyms_detected(self):
        assert all(is_abbreviation(a) for a in ["PDS", "ATS", "ALS", "CDG-2d"])

    def test_words_rejected(self):
        assert not any(is_abbreviation(w) for w in ["asthma", "type 2", "disease"])
