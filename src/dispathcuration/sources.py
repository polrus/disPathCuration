"""Label sources: what the matcher runs over, and how each source differs.

The pipeline was built for Reactome. GO biological_process is a second source with
different conventions, and the differences are captured here rather than scattered
through the code. A `Source` says where the labels come from, how to filter them,
whether the Reactome-only template extractor applies, where gene membership lives,
and whether a curated disease baseline exists to evaluate against.

Two sources are defined:

- REACTOME: pathway labels, templated ("Defective GENE causes DISEASE"), gene
  membership from `target.pathways`, evaluated against `evidence_reactome`.
- GO_BP: biological_process labels, no templates, gene membership from `target.go`
  (aspect P), no disease baseline. GO describes processes, not disease pathways,
  so it yields fewer and noisier matches and leans on the LLM judge.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

import polars as pl

from .data import fetch


@dataclass(frozen=True)
class Source:
    name: str
    label_dataset: str
    # True to keep a label. None means keep all (Reactome). GO filters to
    # non-obsolete biological_process.
    keep_biological_process_only: bool
    use_templates: bool
    # Which target field carries membership, and how to read the term id from it.
    membership_field: str  # "pathways" or "go"
    membership_id_key: str  # struct field holding the term id
    membership_aspect: str | None  # for GO, keep only this aspect ("P")
    evidence_dataset: str | None

    def load_labels(self) -> pl.DataFrame:
        """Return the labels to match over, as columns id and label."""
        frame = fetch(self.label_dataset)
        if self.keep_biological_process_only:
            frame = frame.filter(
                (pl.col("namespace") == "biological_process")
                & (~pl.col("isObsolete"))
            )
        return frame.select("id", "label")

    def term_genes(self) -> dict[str, set[str]]:
        """Map each term id to the set of target ids annotated to it.

        Reactome membership comes from `target.pathways`; GO from `target.go`,
        restricted to the biological_process aspect.
        """
        targets = fetch("target", columns=["id", self.membership_field])
        exploded = (
            targets.explode(self.membership_field)
            .drop_nulls(self.membership_field)
            .with_columns(
                pl.col(self.membership_field)
                .struct.field(self.membership_id_key)
                .alias("term")
            )
        )
        if self.membership_aspect is not None:
            exploded = exploded.with_columns(
                pl.col(self.membership_field).struct.field("aspect").alias("aspect")
            ).filter(pl.col("aspect") == self.membership_aspect)

        membership: dict[str, set[str]] = defaultdict(set)
        for gene, term in zip(exploded["id"], exploded["term"], strict=True):
            membership[term].add(gene)
        return membership


REACTOME = Source(
    name="reactome",
    label_dataset="reactome",
    keep_biological_process_only=False,
    use_templates=True,
    membership_field="pathways",
    membership_id_key="pathwayId",
    membership_aspect=None,
    evidence_dataset="evidence_reactome",
)

GO_BP = Source(
    name="go",
    label_dataset="go",
    keep_biological_process_only=True,
    use_templates=False,
    membership_field="go",
    membership_id_key="id",
    membership_aspect="P",
    evidence_dataset=None,
)

SOURCES = {source.name: source for source in (REACTOME, GO_BP)}


def get_source(name: str) -> Source:
    if name not in SOURCES:
        raise KeyError(f"unknown source {name!r}; expected one of {sorted(SOURCES)}")
    return SOURCES[name]
