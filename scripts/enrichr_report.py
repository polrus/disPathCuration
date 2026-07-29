"""Generate a per-library report of the Enrichr disease-pathway extraction.

Usage:  python scripts/enrichr_report.py
Reads:  data/enrichr/matches_<library>.csv, data/enrichr/*.gmt
Writes: docs/enrichr-report.md
"""

from __future__ import annotations

import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from dispathcuration.config import PROJECT_ROOT  # noqa: E402
from dispathcuration.enrichr import ENRICHR_DIR, PATHWAY_LIBRARIES, term_genes  # noqa: E402

# Why a library produced no matches, when it did not.
ZERO_REASONS = {
    "PFOCR_Pathways_2023": "terms are PMC figure IDs (e.g. `PMC102186 F9`), not pathway "
    "names, so there is no label to match; not applicable to label matching.",
    "HumanCyc_2016": "metabolic pathways only; no term names a disease.",
    "MSigDB_Computational": "terms are computational gene-module IDs (e.g. `MORF ATRX`), "
    "not disease-named pathways.",
    "MSigDB_Oncogenic_Signatures": "terms are perturbation signatures (e.g. `AKT_UP.V1_UP`), "
    "not disease-named pathways.",
}


def _term_count(library: str) -> int:
    path = ENRICHR_DIR / f"{library}.gmt"
    return sum(1 for line in path.read_text().splitlines() if line.strip()) if path.exists() else 0


def main() -> None:
    # Prefer the judged output; fall back to raw matches if not yet judged.
    judged_path = ENRICHR_DIR / "enrichr_matches_judged_all.csv"
    judged = judged_path.exists()

    out = ["# Enrichr disease-pathway extraction: per-library report", ""]
    out += [
        "Disease names found in the term labels of Enrichr pathway libraries, using the "
        "disease chunk index and the matcher (templates off), then the LLM judge (Sonnet). "
        "Reactome and GO are excluded (covered via Open Targets); mouse variants are "
        "excluded (mouse gene symbols do not map to human targets). Counts below are "
        "judge-kept unless stated; the judge rejected 26 of 1,144 (2.3%).",
        "",
        "## Summary",
        "",
        "| Library | Terms | Matches | Kept | Rejected | Diseases | Target-disease |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]

    def load(library):
        if judged:
            m = pl.read_csv(judged_path).filter(pl.col("library") == library)
            return m
        csv = ENRICHR_DIR / f"matches_{library}.csv"
        return pl.read_csv(csv) if csv.exists() and csv.stat().st_size else pl.DataFrame()

    rows = []
    for library in PATHWAY_LIBRARIES:
        terms = _term_count(library)
        m = load(library)
        n = m.height
        kept = m.filter(pl.col("verdict") == "keep") if (n and judged) else m
        rej = m.filter(pl.col("verdict") == "reject").height if (n and judged) else 0
        diseases = kept["diseaseId"].n_unique() if kept.height else 0
        td = 0
        if kept.height:
            genes = term_genes(library)
            td = len({
                (g, did)
                for pid, did in zip(kept["pathwayId"], kept["diseaseId"], strict=True)
                for g in genes.get(pid, ())
            })
        rows.append((library, terms, n, kept, rej, diseases, td))
        out.append(
            f"| {library} | {terms} | {n} | {kept.height} | {rej} | {diseases} | {td} |"
        )

    total = sum(r[2] for r in rows)
    total_kept = sum(r[3].height for r in rows)
    out.append(f"| **Total** | | **{total}** | **{total_kept}** | | | |")
    out += ["", "## Per library (judge-kept)", ""]

    for library, terms, n, kept, rej, diseases, td in sorted(rows, key=lambda r: -r[3].height):
        out.append(f"### {library}")
        out.append("")
        if n == 0:
            reason = ZERO_REASONS.get(library, "no term names a disease.")
            out += [f"{terms} terms, **0 matches**: {reason}", ""]
            continue
        out.append(
            f"{terms} terms, **{kept.height} kept** ({rej} rejected) over {diseases} "
            f"diseases, {td} target-disease pairs."
        )
        out += ["", "| Pathway | Disease | Matched via | Method |", "| --- | --- | --- | --- |"]
        seen = set()
        for r in kept.iter_rows(named=True):
            key = (r["pathwayLabel"], r["diseaseName"])
            if key in seen:
                continue
            seen.add(key)
            syn = r.get("matchedSynonym") or r["matchedText"]
            out.append(
                f"| {r['pathwayLabel'][:48]} | {r['diseaseName'][:36]} | {syn[:32]} | {r['method']} |"
            )
            if len(seen) >= 8:
                break
        out.append("")

    if judged:
        out += ["## Judge rejections (contextual false positives removed)", ""]
        out += ["| Library | Pathway | Matched | Disease | Reason |",
                "| --- | --- | --- | --- | --- |"]
        rej_all = pl.read_csv(judged_path).filter(pl.col("verdict") == "reject")
        for r in rej_all.iter_rows(named=True):
            out.append(
                f"| {r['library']} | {r['pathwayLabel'][:34]} | {r['matchedText'][:20]} "
                f"| {r['diseaseName'][:20]} | {r['reason'][:60]} |"
            )
        out.append("")

    (PROJECT_ROOT / "docs" / "enrichr-report.md").write_text("\n".join(out) + "\n")
    print(f"wrote docs/enrichr-report.md ({total_kept} kept of {total} across {len(rows)} libraries)")


if __name__ == "__main__":
    main()
