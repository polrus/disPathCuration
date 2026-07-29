"""Enrichr pathway libraries as a label source.

This is a separate data layer from the Open Targets pipeline: Enrichr ships each
library as a single GMT file where every row is a pathway term followed by its
gene set, so labels and gene membership come from one file with no join. It
reuses the disease chunk index, the matcher and the judge, but has its own
loader and runner rather than being wired into the Open Targets `Source`
abstraction.

A GMT row is: term <tab> description <tab> gene <tab> gene ... Genes are HGNC
symbols, sometimes suffixed with a weight ("GENE,1.0"); the weight is stripped.
"""

from __future__ import annotations

import sys

import polars as pl
import requests

from .config import PROJECT_ROOT

ENRICHR_GMT = "https://maayanlab.cloud/Enrichr/geneSetLibrary?mode=text&libraryName={}"
ENRICHR_DIR = PROJECT_ROOT / "data" / "enrichr"

# Curated pathway libraries, latest version of each, human or organism-agnostic.
# Reactome and GO are excluded (already covered via Open Targets); mouse variants
# are excluded (mouse gene symbols do not map to human targets).
PATHWAY_LIBRARIES = [
    "KEGG_2026",
    "WikiPathways_2024_Human",
    "PFOCR_Pathways_2023",
    "Elsevier_Pathway_Collection",
    "BioPlanet_2019",
    "BioCarta_2016",
    "NCI-Nature_2016",
    "Panther_2016",
    "HumanCyc_2016",
    "MSigDB_Hallmark_2020",
    "MSigDB_Computational",
    "MSigDB_Oncogenic_Signatures",
]


def _gmt_path(library: str):
    return ENRICHR_DIR / f"{library}.gmt"


def download_gmt(library: str, force: bool = False):
    """Download a library's GMT to the local cache and return its path."""
    ENRICHR_DIR.mkdir(parents=True, exist_ok=True)
    local = _gmt_path(library)
    if force or not local.exists():
        url = ENRICHR_GMT.format(library)
        print(f"downloading {library} from {url}", file=sys.stderr)
        response = requests.get(url, timeout=300)
        response.raise_for_status()
        if not response.text.strip():
            raise RuntimeError(f"empty GMT for {library!r} (unknown library name?)")
        local.write_text(response.text)
    return local


def _parse_gmt(text: str) -> list[tuple[str, list[str]]]:
    rows = []
    for line in text.splitlines():
        if not line.strip():
            continue
        fields = line.split("\t")
        term = fields[0].strip()
        # fields[1] is a description (often empty); genes follow.
        genes = [g.split(",")[0].strip().upper() for g in fields[2:] if g.strip()]
        if term:
            rows.append((term, genes))
    return rows


def load_library(library: str) -> pl.DataFrame:
    """Return a library as rows of (id, label, genes).

    `id` and `label` are both the term name (Enrichr terms have no separate id),
    so the frame matches the matcher's expected `id`/`label` columns.
    """
    text = download_gmt(library).read_text()
    rows = _parse_gmt(text)
    return pl.DataFrame(
        {
            "id": [t for t, _ in rows],
            "label": [t for t, _ in rows],
            "genes": [g for _, g in rows],
        },
        schema={"id": pl.String, "label": pl.String, "genes": pl.List(pl.String)},
    )


def term_genes(library: pl.DataFrame | str) -> dict[str, set[str]]:
    """Map each term to its gene set for a loaded library (or library name)."""
    frame = load_library(library) if isinstance(library, str) else library
    return {
        term: set(genes)
        for term, genes in zip(frame["label"], frame["genes"], strict=True)
    }
