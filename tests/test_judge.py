"""Judge tests, all offline: a stub backend replaces the Claude Code call."""

import sys
from pathlib import Path

import polars as pl

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from dispathcuration.judge import (  # noqa: E402
    _parse,
    judge_matches,
    select_low_confidence,
)


def _matches(rows):
    return pl.DataFrame(
        rows,
        schema=[
            ("pathwayId", pl.String),
            ("pathwayLabel", pl.String),
            ("diseaseId", pl.String),
            ("method", pl.String),
            ("matchedText", pl.String),
            ("nDiseases", pl.Int64),
        ],
        orient="row",
    )


def _chunks(rows):
    return pl.DataFrame(
        rows, schema=[("chunk", pl.String), ("specificity", pl.Float64)], orient="row"
    )


class TestParse:
    def test_strips_code_fence(self):
        text = '```json\n[{"id":1,"verdict":"keep","reason":"ok"}]\n```'
        assert _parse(text, 1)[0]["verdict"] == "keep"

    def test_missing_id_marked_error(self):
        parsed = _parse('[{"id":1,"verdict":"keep","reason":"ok"}]', 2)
        assert parsed[1]["verdict"] == "error"


class TestSelection:
    def test_alias_and_low_spec_wholeform_selected(self):
        matches = _matches(
            [
                ("p1", "L1", "D1", "alias", "hiv", 1),
                ("p2", "L2", "D2", "whole_form", "asthma", 1),          # low spec
                ("p3", "L3", "D3", "whole_form", "hyperargininemia", 1),  # high spec
                ("p4", "L4", "D4", "template", "sialidosis", 1),
            ]
        )
        chunks = _chunks(
            [("hiv", 7.0), ("asthma", 7.4), ("hyperargininemia", 20.0), ("sialidosis", 10.0)]
        )
        selected = set(select_low_confidence(matches, chunks)["pathwayId"])
        assert selected == {"p1", "p2"}  # not p3 (high spec), not p4 (template)


class TestJudgeMatches:
    def _fake_backend(self, calls):
        def backend(prompt, model):
            calls.append(prompt)
            # keep everything except any label mentioning "hypoxia"
            lines = [l for l in prompt.splitlines() if l and l[0].isdigit()]
            out = []
            for i, line in enumerate(lines, start=1):
                verdict = "reject" if "hypoxia" in line.lower() else "keep"
                out.append(f'{{"id":{i},"verdict":"{verdict}","reason":"x"}}')
            return "[" + ",".join(out) + "]"

        return backend

    def test_verdicts_annotated(self):
        candidates = _matches(
            [
                ("p1", "Uncoating of HIV", "D1", "alias", "hiv", 1),
                ("p2", "Response to hypoxia", "D2", "alias", "hypoxia", 1),
            ]
        )
        judged = judge_matches(
            candidates, {"D1": "HIV", "D2": "hypoxia"}, backend=self._fake_backend([])
        )
        verdicts = dict(zip(judged["pathwayId"], judged["verdict"]))
        assert verdicts == {"p1": "keep", "p2": "reject"}

    def test_cache_skips_second_call(self):
        candidates = _matches([("p1", "Uncoating of HIV", "D1", "alias", "hiv", 1)])
        cache: dict = {}
        calls: list = []
        backend = self._fake_backend(calls)
        judge_matches(candidates, {"D1": "HIV"}, backend=backend, cache=cache)
        judge_matches(candidates, {"D1": "HIV"}, backend=backend, cache=cache)
        assert len(calls) == 1  # second run served entirely from cache
