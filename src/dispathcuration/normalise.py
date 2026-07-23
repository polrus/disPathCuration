"""Surface form normalisation.

Disease labels and pathway labels are written by different curators under
different conventions. Normalisation puts both sides into one comparable form
so that a match is not lost to casing, an apostrophe, or a Greek letter.
"""

from __future__ import annotations

import re
import unicodedata

GREEK = {
    "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta",
    "ε": "epsilon", "κ": "kappa", "λ": "lambda", "μ": "mu",
    "σ": "sigma", "ω": "omega",
}

ROMAN = {
    "i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5",
    "vi": "6", "vii": "7", "viii": "8", "ix": "9", "x": "10",
}

# Roman numerals are only converted after these words. Bare "v" or "x" in a
# label is far more often a gene or a letter than a numeral.
ROMAN_TRIGGERS = frozenset({"type", "class", "group", "stage", "grade", "factor"})

_POSSESSIVE = re.compile(r"(\w)['’]s\b")
_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_WHITESPACE = re.compile(r"\s+")


def normalise(text: str) -> str:
    """Return a canonical lowercase form of `text`.

    Applies, in order: Unicode compatibility decomposition, Greek letter
    expansion, possessive stripping, punctuation to whitespace, and Roman
    numeral conversion in positions where a numeral is expected.
    """
    if not text:
        return ""

    text = unicodedata.normalize("NFKD", text)
    text = "".join(GREEK.get(char, char) for char in text)
    # Drop combining marks left behind by decomposition.
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.lower()

    # "Parkinson's disease" -> "parkinson disease", agreeing with the MONDO
    # spelling. Stripping a bare trailing "s" as well was tried and reverted:
    # in EFO the apostrophe-free pattern is 1838 ordinary words ("infectious
    # disease", "Chagas disease") against 292 true possessives, so the rule
    # corrupted far more names than it repaired.
    text = _POSSESSIVE.sub(r"\1", text)

    text = _NON_ALNUM.sub(" ", text)
    text = _WHITESPACE.sub(" ", text).strip()

    tokens = text.split()
    for index in range(1, len(tokens)):
        if tokens[index - 1] in ROMAN_TRIGGERS and tokens[index] in ROMAN:
            tokens[index] = ROMAN[tokens[index]]

    return " ".join(tokens)


def is_abbreviation(text: str) -> bool:
    """True if `text` looks like an acronym rather than a spelled-out name.

    Acronyms must be matched case sensitively and as whole tokens. Folding
    "ATS" or "PDS" into the main lowercase index would make them collide with
    ordinary words and with each other.
    """
    stripped = text.strip()
    if not stripped or len(stripped) > 12 or " " in stripped:
        return False

    letters = [char for char in stripped if char.isalpha()]
    if len(letters) < 2:
        return False

    upper = sum(1 for char in letters if char.isupper())
    return upper / len(letters) >= 0.5
