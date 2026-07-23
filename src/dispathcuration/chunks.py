"""Generate searchable chunks from disease surface forms.

Whole disease names rarely appear verbatim in a pathway label: EFO names run to
5.4 tokens on average, while Reactome labels name a disease in passing. Matching
therefore has to happen on sub-spans.

The problem with sub-spans is that most of them are worthless. "type", "2",
"disease" and "deficiency" occur across thousands of diseases, so a chunk index
built from raw n-grams matches everything and resolves nothing.

Two signals separate the two, and both are needed.

`specificity` is the summed inverse document frequency of a chunk's tokens over
the disease corpus, so "diabetes mellitus" scores high and "type 2" near zero.

`coverage` is the share of its surface form's total IDF mass that the chunk
carries, so a chunk equal to the whole name scores 1.0 and an incidental
fragment scores low. Specificity alone is not sufficient: "hyperargininemia",
which is a complete disease name, and "cause", which is a fragment of "death by
undetermined cause", both score 9.31 because both occur in exactly two diseases.
Only coverage tells them apart, at 1.0 against 0.30.
"""

from __future__ import annotations

import math
from collections import Counter, defaultdict

import polars as pl

from .config import GENERIC_HEADS, STOPWORDS

MAX_CHUNK_TOKENS = 6


def token_idf(surface: pl.DataFrame) -> dict[str, float]:
    """Inverse document frequency per token, with the disease as the document.

    Document frequency counts distinct diseases rather than distinct surface
    forms, so a disease carrying ten synonyms that all repeat a token does not
    inflate that token's apparent commonness.
    """
    seen: dict[str, set[str]] = defaultdict(set)
    for disease_id, normalised in zip(
        surface["diseaseId"], surface["normalised"], strict=True
    ):
        for token in normalised.split():
            seen[token].add(disease_id)

    total = surface["diseaseId"].n_unique()
    return {token: math.log(total / len(ids)) for token, ids in seen.items()}


def _spans(tokens: list[str]) -> list[tuple[str, int]]:
    """Contiguous token spans, trimmed of leading and trailing function words."""
    out: set[tuple[str, int]] = set()
    limit = min(len(tokens), MAX_CHUNK_TOKENS)

    for size in range(1, limit + 1):
        for start in range(len(tokens) - size + 1):
            span = tokens[start : start + size]

            # A chunk that opens or closes on a function word is an artefact of
            # the sliding window, not a term. Trim rather than drop, so that
            # "diseases of glycosylation" still yields "glycosylation".
            while span and span[0] in STOPWORDS:
                span = span[1:]
            while span and span[-1] in STOPWORDS:
                span = span[:-1]
            if not span:
                continue

            # Chunks made purely of ontology scaffolding carry no identity.
            if all(token in GENERIC_HEADS or token in STOPWORDS for token in span):
                continue

            out.add((" ".join(span), len(span)))

    # The full form is always retained, even past MAX_CHUNK_TOKENS, so that an
    # exact whole-name match is never lost to the cap.
    if tokens:
        out.add((" ".join(tokens), len(tokens)))

    return sorted(out)


def build_chunks(surface: pl.DataFrame, idf: dict[str, float]) -> pl.DataFrame:
    """Expand surface forms into scored chunks.

    Returns one row per (diseaseId, surface form, chunk) carrying:
      specificity  summed token IDF, the absolute informativeness of the chunk
      coverage     share of the surface form's IDF mass the chunk accounts for
      nDiseases    how many distinct diseases share the chunk, i.e. how
                   ambiguous a hit on it would be
    """
    rows: list[tuple[str, str, str, str, bool, str, int, float, float]] = []
    sharing: dict[str, set[str]] = defaultdict(set)

    for disease_id, name, source, is_abbrev, normalised in zip(
        surface["diseaseId"],
        surface["diseaseName"],
        surface["source"],
        surface["isAbbreviation"],
        surface["normalised"],
        strict=True,
    ):
        # Abbreviations are atomic. Splitting "CDG-2d" into spans would produce
        # noise, and they are matched case sensitively elsewhere.
        tokens = normalised.split()
        spans = [(normalised, len(tokens))] if is_abbrev else _spans(tokens)

        # Denominator for coverage. Guarded because a surface form made only of
        # tokens unseen elsewhere can sum to zero.
        total_idf = sum(idf.get(token, 0.0) for token in tokens) or 1.0

        for chunk, size in spans:
            specificity = sum(idf.get(token, 0.0) for token in chunk.split())
            rows.append(
                (
                    disease_id, name, normalised, source, is_abbrev,
                    chunk, size, specificity, min(specificity / total_idf, 1.0),
                )
            )
            sharing[chunk].add(disease_id)

    chunks = pl.DataFrame(
        rows,
        schema=[
            ("diseaseId", pl.String),
            ("diseaseName", pl.String),
            ("surfaceForm", pl.String),
            ("source", pl.String),
            ("isAbbreviation", pl.Boolean),
            ("chunk", pl.String),
            ("nTokens", pl.Int32),
            ("specificity", pl.Float64),
            ("coverage", pl.Float64),
        ],
        orient="row",
    )

    ambiguity = pl.DataFrame(
        {
            "chunk": list(sharing.keys()),
            "nDiseases": [len(ids) for ids in sharing.values()],
        },
        schema={"chunk": pl.String, "nDiseases": pl.UInt32},
    )

    return chunks.join(ambiguity, on="chunk", how="left")


def chunk_frequency(surface: pl.DataFrame) -> Counter[str]:
    """Token counts across surface forms. Exposed for stoplist review."""
    return Counter(
        token for form in surface["normalised"] for token in form.split()
    )
