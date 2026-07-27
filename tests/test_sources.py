"""Source abstraction tests.

Unit tests for template gating (synthetic, always run) and the source registry.
An integration test loads GO labels only when the cached data is present.
"""

import sys
from pathlib import Path

import polars as pl
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from dispathcuration.config import DATA_DIR  # noqa: E402
from dispathcuration.matcher import (  # noqa: E402
    build_slot_index,
    build_whole_form_index,
    Matcher,
)
from dispathcuration.sources import GO_BP, REACTOME, get_source  # noqa: E402


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


class TestSourceRegistry:
    def test_reactome_config(self):
        assert REACTOME.use_templates is True
        assert REACTOME.evidence_dataset == "evidence_reactome"
        assert REACTOME.membership_field == "pathways"

    def test_go_config(self):
        assert GO_BP.use_templates is False
        assert GO_BP.evidence_dataset is None
        assert GO_BP.membership_field == "go"
        assert GO_BP.membership_aspect == "P"

    def test_unknown_source_raises(self):
        with pytest.raises(KeyError):
            get_source("kegg")


class TestTemplateGating:
    """A GO-style matcher (use_templates=False) must not fire on a label that
    would match the Reactome 'causes' template."""

    def _matcher(self, use_templates):
        chunks = _chunks([("sialidosis", "D1", False, 1.0, 1, 10.0, 1)])
        return Matcher(
            build_whole_form_index(chunks),
            build_slot_index(chunks),
            {},
            use_templates=use_templates,
        )

    def test_templates_on_fires(self):
        matches = self._matcher(True).match_label("p", "Defective NEU1 causes sialidosis")
        assert any(m.method == "template" for m in matches)

    def test_templates_off_skips(self):
        matches = self._matcher(False).match_label("p", "Defective NEU1 causes sialidosis")
        assert all(m.method != "template" for m in matches)


@pytest.mark.skipif(
    not (DATA_DIR / "go.parquet").exists(), reason="GO dataset not downloaded"
)
class TestGoLabelLoading:
    def test_filters_to_non_obsolete_biological_process(self):
        labels = GO_BP.load_labels()
        assert set(labels.columns) == {"id", "label"}
        assert labels.height > 20000  # ~24k non-obsolete BP terms
        assert labels.height < 30874  # fewer than all BP (obsolete dropped)
