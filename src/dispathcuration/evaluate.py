"""Compare matcher output against the curated Reactome evidence.

The evidence is treated as a recall floor, not a ceiling: the project's premise
is that it is incomplete. Two questions are asked of it.

- Recovery: of the curated pathway-disease pairs, which does the matcher
  reproduce, and by what relationship (exact, more specific, more general)?
- Non-recovery: for the pairs the matcher does not reproduce, why not?

A recovered pair is not always an exact identifier match. The matcher often
extracts a more specific disease than the curator recorded, because a template
label names the precise subtype ("Defective NEU1 causes sialidosis") while the
evidence maps the pathway to a parent ("Lysosomal disease"). These are counted
as recoveries that *add specificity*, not as misses.
"""

from __future__ import annotations

from collections import defaultdict

import polars as pl


def evidence_pairs(evidence_reactome: pl.DataFrame) -> pl.DataFrame:
    """Distinct (pathwayId, diseaseId) pairs in the curated evidence."""
    return (
        evidence_reactome.select(
            "diseaseId",
            pl.col("pathways")
            .list.eval(pl.element().struct.field("id"))
            .alias("pathwayId"),
        )
        .explode("pathwayId")
        .drop_nulls()
        .unique()
    )


def _ancestry(diseases: pl.DataFrame) -> tuple[dict[str, set], dict[str, set]]:
    ancestors = {
        i: set(a)
        for i, a in zip(diseases["id"], diseases["ancestors"].to_list(), strict=True)
    }
    descendants = {
        i: set(a)
        for i, a in zip(diseases["id"], diseases["descendants"].to_list(), strict=True)
    }
    return ancestors, descendants


def recovery_report(
    matches: pl.DataFrame,
    evidence_reactome: pl.DataFrame,
    diseases: pl.DataFrame,
) -> dict:
    """Classify every curated evidence pair by how the matcher recovers it.

    Categories:
      exact             matcher found the same disease id
      more_specific     matcher found a descendant of the curated disease
                        (the label named a subtype; the matcher adds specificity)
      more_general      matcher found an ancestor of the curated disease
      not_recovered     matcher put no related disease on that pathway
    """
    ancestors, descendants = _ancestry(diseases)
    pairs = evidence_pairs(evidence_reactome)

    found: dict[str, set[str]] = defaultdict(set)
    for pathway_id, disease_id in zip(
        matches["pathwayId"], matches["diseaseId"], strict=True
    ):
        found[pathway_id].add(disease_id)

    counts: dict[str, int] = defaultdict(int)
    detail: dict[str, list[tuple[str, str]]] = defaultdict(list)

    for pathway_id, curated in zip(
        pairs["pathwayId"], pairs["diseaseId"], strict=True
    ):
        matched = found.get(pathway_id, set())
        if curated in matched:
            category = "exact"
        elif any(curated in ancestors.get(m, set()) for m in matched):
            # curated is an ancestor of something we found -> we are more specific
            category = "more_specific"
        elif any(curated in descendants.get(m, set()) for m in matched):
            category = "more_general"
        else:
            category = "not_recovered"
        counts[category] += 1
        detail[category].append((pathway_id, curated))

    counts["total_evidence_pairs"] = pairs.height
    counts["recovered"] = (
        counts["exact"] + counts["more_specific"] + counts["more_general"]
    )
    return {"counts": dict(counts), "detail": dict(detail)}


def non_recovery_reasons(
    matches: pl.DataFrame,
    evidence_reactome: pl.DataFrame,
    diseases: pl.DataFrame,
) -> dict:
    """Explain, per curated pathway, why its disease was not recovered.

    Reasons:
      label_names_no_disease  the matcher put no disease on the pathway at all;
                              the label describes biology and never names the
                              curated disease. Unreachable by any label method.
      matcher_named_other     the matcher found a different, unrelated disease on
                              the pathway. Usually the curated term is a broad
                              parent or an associated phenotype (goiter for
                              Pendred syndrome) while the label names the precise
                              disease, which the matcher reports instead.
    """
    ancestors, descendants = _ancestry(diseases)
    pairs = evidence_pairs(evidence_reactome)

    found: dict[str, set[str]] = defaultdict(set)
    for pathway_id, disease_id in zip(
        matches["pathwayId"], matches["diseaseId"], strict=True
    ):
        found[pathway_id].add(disease_id)

    counts: dict[str, int] = defaultdict(int)
    detail: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for pathway_id, curated in zip(
        pairs["pathwayId"], pairs["diseaseId"], strict=True
    ):
        matched = found.get(pathway_id, set())
        if curated in matched:
            continue
        if any(
            curated in ancestors.get(m, set()) or curated in descendants.get(m, set())
            for m in matched
        ):
            continue  # recovered via ontology, handled in recovery_report
        reason = "matcher_named_other" if matched else "label_names_no_disease"
        counts[reason] += 1
        detail[reason].append((pathway_id, curated))
    return {"counts": dict(counts), "detail": dict(detail)}


def novelty_report(
    matches: pl.DataFrame, evidence_reactome: pl.DataFrame
) -> dict:
    """Count matcher pairs absent from curated evidence: the candidate output."""
    pairs = evidence_pairs(evidence_reactome)
    curated = set(zip(pairs["pathwayId"], pairs["diseaseId"], strict=True))
    found = set(zip(matches["pathwayId"], matches["diseaseId"], strict=True))
    new = found - curated
    by_method = (
        matches.filter(
            pl.struct("pathwayId", "diseaseId").is_in(
                [{"pathwayId": p, "diseaseId": d} for p, d in new]
            )
        )["method"].value_counts(sort=True)
        if new
        else pl.DataFrame({"method": [], "count": []})
    )
    return {
        "new_pairs": len(new),
        "curated_pairs": len(curated),
        "by_method": by_method,
    }
