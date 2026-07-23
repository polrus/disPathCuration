"""Match disease names in pathway labels.

Three complementary extractors run over each pathway label, in order of
precedence. A pathway-disease pair is kept once, labelled with the strongest
method that produced it.

1. `template`   The highest-precision signal. Reactome labels follow fixed
                templates ("Defective GENE causes DISEASE"), and the disease
                slot is a disease by construction. This licenses matching a
                disease that appears only as an abbreviation ("PXE"), which
                free-floating matching must never trust. It also tends to
                resolve a more specific disease than the curated evidence.

2. `whole_form` Whole disease names or exact synonyms found as a contiguous
                token span. High precision, the workhorse. Fragments are never
                matched, and generic one-word names are held back by a
                specificity floor.

3. `alias`      Distinctive disease tokens that stand alone in a label without
                a template ("HIV", "SARS"). Safety filtered: not a gene symbol,
                at least three characters, unambiguous.

Global abbreviation matching is deliberately absent. Tested against the
Reactome evidence it recovered 10 links while adding 61 acronym collisions, a
6:1 loss. The template and alias mechanisms recover the same genuine cases
without that cost.
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass

import polars as pl

from .config import (
    ALIAS_ALLOWLIST,
    ALIAS_AUTO_LENGTH,
    MAX_ALIAS_SHARING,
    MIN_SPECIFICITY,
    SINGLE_TOKEN_MIN_SPECIFICITY,
)
from .normalise import normalise

# Templates whose trailing group is a disease slot. Anchored at the start so
# they match the label's overall shape, not an incidental substring.
TEMPLATES = [
    re.compile(p)
    for p in (
        r"^defective\s+\S+\s+causes?\s+(.+)$",
        r"^\S+\s+deficiency\s+causes?\s+(.+)$",
        r"^\S+\s+variants?\s+causes?\s+(.+)$",
        r"^\S+\s+mutations?\s+cause[sd]?\s+(.+)$",
    )
]


@dataclass(frozen=True)
class Match:
    pathwayId: str
    pathwayLabel: str
    diseaseId: str
    method: str
    matchedText: str
    nDiseases: int  # ambiguity of the matched form: how many diseases share it


# --------------------------------------------------------------------------- #
# Index construction
# --------------------------------------------------------------------------- #


def build_whole_form_index(
    chunks: pl.DataFrame,
    min_specificity: float = MIN_SPECIFICITY,
    single_token_min_specificity: float = SINGLE_TOKEN_MIN_SPECIFICITY,
) -> dict[str, frozenset[str]]:
    """Whole disease names and synonyms, for free-floating matching.

    Keeps only chunks that are a complete surface form (coverage 1.0) and not an
    abbreviation, that clear the specificity floor, and, if a single token, the
    stricter single-token floor.
    """
    kept = chunks.filter(
        (pl.col("coverage") >= 1.0)
        & (~pl.col("isAbbreviation"))
        & (pl.col("specificity") >= min_specificity)
        & (
            (pl.col("nTokens") >= 2)
            | (pl.col("specificity") >= single_token_min_specificity)
        )
    )
    return _group(kept)


def build_slot_index(chunks: pl.DataFrame) -> dict[str, frozenset[str]]:
    """Whole surface forms including abbreviations, for template slots only.

    Abbreviations are admitted here because a template slot has already proven
    the span is a disease, so an acronym in it is licensed.
    """
    kept = chunks.filter(pl.col("coverage") >= 1.0)
    return _group(kept)


def build_alias_index(
    chunks: pl.DataFrame,
    gene_symbols: set[str],
    auto_length: int = ALIAS_AUTO_LENGTH,
    allowlist: dict[str, str] = ALIAS_ALLOWLIST,
    max_sharing: int = MAX_ALIAS_SHARING,
) -> dict[str, frozenset[str]]:
    """Distinctive single-token disease aliases safe to match free-floating.

    Two sources are combined:

    - Auto-derived long words: a whole surface form of one token, at least
      `auto_length` characters, not a gene symbol, the whole name of exactly one
      disease, and shared across at most `max_sharing` diseases (which keeps
      "influenza" and drops "cancer").
    - The reviewed `allowlist`: short acronyms mapped explicitly to one disease,
      admitted regardless of the auto rules, because a bare acronym cannot be
      auto-trusted and "hiv" is not even present as a whole disease name.
    """
    kept = chunks.filter(
        (pl.col("coverage") >= 1.0)
        & (pl.col("nTokens") == 1)
        & (pl.col("chunk").str.len_chars() >= auto_length)
        & (pl.col("nDiseases") <= max_sharing)
    )
    grouped = _group(kept)
    index = {
        token: ids
        for token, ids in grouped.items()
        if token not in gene_symbols and len(ids) == 1
    }
    for token, disease_id in allowlist.items():
        index[token] = frozenset({disease_id})
    return index


def _group(chunks: pl.DataFrame) -> dict[str, frozenset[str]]:
    """Collapse a chunk frame to form -> frozenset of diseaseIds."""
    acc: dict[str, set[str]] = defaultdict(set)
    for chunk, disease_id in zip(chunks["chunk"], chunks["diseaseId"], strict=True):
        acc[chunk].add(disease_id)
    return {form: frozenset(ids) for form, ids in acc.items()}


# --------------------------------------------------------------------------- #
# Template slot resolution
# --------------------------------------------------------------------------- #


def disease_slot(label: str) -> str | None:
    """Return the disease-slot substring of a templated label, or None."""
    low = label.lower()
    for template in TEMPLATES:
        found = template.match(low)
        if found:
            return found.group(1)
    return None


def _slot_candidates(slot: str) -> list[str]:
    """Normalised forms to try for a disease slot, most spelled-out first.

    "Pendred syndrome (PDS)" yields "pendred syndrome" before "pds", so the
    unambiguous full name wins over the ambiguous acronym.
    """
    base = re.sub(r"\s*\([^)]*\)\s*$", "", slot).strip()
    ordered = [normalise(base), normalise(slot)]
    if "-" in base:
        # "b4galt1-cdg" also offers its tail "cdg".
        ordered.append(normalise(base.split("-")[-1]))
    ordered += [normalise(p) for p in re.findall(r"\(([^)]+)\)", slot)]

    seen: set[str] = set()
    out = []
    for form in ordered:
        if form and form not in seen:
            seen.add(form)
            out.append(form)
    return out


def resolve_slot(
    slot: str, slot_index: dict[str, frozenset[str]]
) -> tuple[str, frozenset[str]] | None:
    """Resolve a disease slot to (matched form, diseaseIds), preferring the
    least ambiguous spelled-out form."""
    candidates = [c for c in _slot_candidates(slot) if c in slot_index]
    if not candidates:
        return None
    best = min(candidates, key=lambda c: (len(slot_index[c]), -len(c)))
    return best, slot_index[best]


# --------------------------------------------------------------------------- #
# Matcher
# --------------------------------------------------------------------------- #


class Matcher:
    def __init__(
        self,
        whole_form_index: dict[str, frozenset[str]],
        slot_index: dict[str, frozenset[str]],
        alias_index: dict[str, frozenset[str]],
    ) -> None:
        self.whole_form_index = whole_form_index
        self.slot_index = slot_index
        self.alias_index = alias_index
        self._max_form_tokens = max(
            (form.count(" ") + 1 for form in whole_form_index), default=1
        )

    def match_label(self, pathway_id: str, label: str) -> list[Match]:
        """All disease matches in one label, deduplicated by disease, keeping
        the highest-precedence method (template > whole_form > alias)."""
        by_disease: dict[str, Match] = {}

        def offer(disease_id: str, method: str, text: str, ambiguity: int) -> None:
            if disease_id not in by_disease:
                by_disease[disease_id] = Match(
                    pathway_id, label, disease_id, method, text, ambiguity
                )

        slot = disease_slot(label)
        if slot is not None:
            resolved = resolve_slot(slot, self.slot_index)
            if resolved is not None:
                form, ids = resolved
                for disease_id in ids:
                    offer(disease_id, "template", form, len(ids))

        tokens = normalise(label).split()
        for size in range(min(self._max_form_tokens, len(tokens)), 0, -1):
            for start in range(len(tokens) - size + 1):
                span = " ".join(tokens[start : start + size])
                ids = self.whole_form_index.get(span)
                if ids:
                    for disease_id in ids:
                        offer(disease_id, "whole_form", span, len(ids))

        for token in tokens:
            ids = self.alias_index.get(token)
            if ids:
                for disease_id in ids:
                    offer(disease_id, "alias", token, len(ids))

        return list(by_disease.values())

    def match_all(self, reactome: pl.DataFrame) -> pl.DataFrame:
        """Match every Reactome label. Returns one row per pathway-disease
        pair."""
        rows = [
            match
            for pathway_id, label in zip(
                reactome["id"], reactome["label"], strict=True
            )
            for match in self.match_label(pathway_id, label)
        ]
        return pl.DataFrame(
            [vars(match) for match in rows],
            schema={
                "pathwayId": pl.String,
                "pathwayLabel": pl.String,
                "diseaseId": pl.String,
                "method": pl.String,
                "matchedText": pl.String,
                "nDiseases": pl.Int64,
            },
        )


def build_matcher(chunks: pl.DataFrame, gene_symbols: set[str]) -> Matcher:
    """Assemble a Matcher from the disease chunk index and gene symbols."""
    return Matcher(
        build_whole_form_index(chunks),
        build_slot_index(chunks),
        build_alias_index(chunks, gene_symbols),
    )
