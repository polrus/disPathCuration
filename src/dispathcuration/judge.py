"""LLM judge that flags context false positives in the low-confidence tier.

The deterministic matcher cannot see context: it matches "hypoxia" or "shock"
wherever the token appears, and it cannot tell that "PCP" means a protein here
rather than the disease. The judge reads the label and decides, per candidate,
whether the matched text genuinely refers to the disease.

It is an annotating layer. It adds `verdict` and `reason` columns; it never
deletes rows. The deterministic candidate table stays the reproducible core.

Backend. Anthropic API access is not required. By default the judge shells out
to the Claude Code CLI in print mode (`claude -p`), which uses the user's
existing Claude Code login. The backend is a single function and can be swapped
for a direct API call later without touching the rest of the module.

Scope. Only the low-confidence tier is judged: the `alias` method and
`whole_form` matches below a specificity threshold. Template matches are
structurally certain and are never sent.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from collections.abc import Callable

import polars as pl

# Haiku by default: the tier is small and this keeps cost low. Opus judges more
# strictly (it rejects borderline cases Haiku keeps) and can be passed instead.
DEFAULT_MODEL = "haiku"
DEFAULT_BATCH_SIZE = 25
LOW_CONFIDENCE_MAX_SPECIFICITY = 12.0

_PROMPT_HEADER = """\
For each item, decide whether the matched text in the pathway label refers to the
given disease. Judge word sense only.

Keep the item if the matched text refers to that disease, EVEN IF the reference is
broad or general. Breadth is not a reason to reject; a general disease term such as
"viral infection" referring to viral infectious disease is a valid match.

Reject ONLY if the matched text means something other than the disease in this
label, for example a gene or protein name, a structural domain, a verb, a cellular
or molecular process unrelated to the disease, or an acronym that here stands for a
different thing. When unsure, keep.

Return ONLY a JSON array, one object per item, no prose and no code fences:
[{"id": <n>, "verdict": "keep" or "reject", "reason": "<short>"}]

Items:
"""

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def select_low_confidence(
    matches: pl.DataFrame,
    chunks: pl.DataFrame,
    max_specificity: float = LOW_CONFIDENCE_MAX_SPECIFICITY,
) -> pl.DataFrame:
    """Return the matches that should be judged: alias, and low-specificity
    whole_form. Template matches are excluded."""
    spec = chunks.group_by("chunk").agg(
        pl.col("specificity").max().alias("_spec")
    )
    annotated = matches.join(spec, left_on="matchedText", right_on="chunk", how="left")
    return annotated.filter(
        (pl.col("method") == "alias")
        | ((pl.col("method") == "whole_form") & (pl.col("_spec") < max_specificity))
    ).drop("_spec")


def _cache_key(label: str, disease_id: str, matched: str) -> str:
    raw = f"{label}\x1f{disease_id}\x1f{matched}"
    return hashlib.sha256(raw.encode()).hexdigest()


def claude_code_backend(prompt: str, model: str = DEFAULT_MODEL) -> str:
    """Run a prompt through the Claude Code CLI in print mode.

    Returns the model's text output. Requires the `claude` CLI to be logged in;
    no ANTHROPIC_API_KEY is used.
    """
    completed = subprocess.run(
        ["claude", "-p", "--model", model, "--output-format", "json"],
        input=prompt,
        capture_output=True,
        text=True,
        timeout=300,
    )
    if completed.returncode != 0:
        raise RuntimeError(f"claude -p failed: {completed.stderr[:400]}")
    envelope = json.loads(completed.stdout)
    if envelope.get("is_error"):
        raise RuntimeError(f"claude -p error: {envelope.get('result')}")
    return envelope["result"]


def _format_batch(rows: list[dict]) -> str:
    lines = [
        f'{i}. label="{r["pathwayLabel"]}" | matched text="{r["matchedText"]}" '
        f'| disease="{r["diseaseName"]}"'
        for i, r in enumerate(rows, start=1)
    ]
    return _PROMPT_HEADER + "\n".join(lines)


def _parse(text: str, size: int) -> list[dict]:
    cleaned = _FENCE.sub("", text).strip()
    verdicts = json.loads(cleaned)
    if not isinstance(verdicts, list):
        raise ValueError("judge did not return a list")
    by_id = {int(v["id"]): v for v in verdicts}
    return [by_id.get(i, {"verdict": "error", "reason": "missing"}) for i in range(1, size + 1)]


def judge_matches(
    candidates: pl.DataFrame,
    disease_names: dict[str, str],
    backend: Callable[[str, str], str] = claude_code_backend,
    model: str = DEFAULT_MODEL,
    batch_size: int = DEFAULT_BATCH_SIZE,
    cache: dict[str, dict] | None = None,
) -> pl.DataFrame:
    """Judge each candidate, returning it with `verdict` and `reason` columns.

    `cache` maps a candidate key to a stored verdict; judged candidates are added
    to it so a re-run skips them. Pass a dict loaded from disk for persistence.
    """
    cache = {} if cache is None else cache
    rows = candidates.with_columns(
        pl.col("diseaseId")
        .replace_strict(disease_names, default="")
        .alias("diseaseName")
    ).to_dicts()

    verdicts: dict[int, dict] = {}
    pending: list[tuple[int, dict]] = []
    for index, row in enumerate(rows):
        key = _cache_key(row["pathwayLabel"], row["diseaseId"], row["matchedText"])
        if key in cache:
            verdicts[index] = cache[key]
        else:
            pending.append((index, row))

    for start in range(0, len(pending), batch_size):
        chunk = pending[start : start + batch_size]
        result = backend(_format_batch([r for _, r in chunk]), model)
        parsed = _parse(result, len(chunk))
        for (index, row), verdict in zip(chunk, parsed, strict=True):
            key = _cache_key(row["pathwayLabel"], row["diseaseId"], row["matchedText"])
            cache[key] = verdict
            verdicts[index] = verdict

    return candidates.with_columns(
        pl.Series("verdict", [verdicts[i].get("verdict", "error") for i in range(len(rows))]),
        pl.Series("reason", [verdicts[i].get("reason", "") for i in range(len(rows))]),
    )
