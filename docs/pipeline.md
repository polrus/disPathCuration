# Pipeline design notes

Forward-looking notes, not yet implemented. Covers two things: what a per-release automated
run needs to be safe, and the design of an LLM judge that removes context false positives.

## Release automation

The pipeline should run unattended on each platform release. The current implementation pins
release 26.06 and assumes 26.06 shapes. The gaps below must close first. They are recorded
here as a checklist, in priority order.

1. **Resolve the newest good release, not `latest`.** `RELEASE` is hardcoded. The `latest`
   symlink cannot be trusted: at the time of writing it pointed at a run whose `manifest.json`
   reported `result: "failure"`. The resolver must list releases, read each manifest newest
   first, and select the first with `result == "success"`.

2. **Load all parts of every dataset.** `data.fetch` silently uses only the first part of a
   single-part dataset (`data.py`, the `_list_parts(name)[0]` branch). `reactome` and
   `evidence_reactome` are single-part today; if a release partitions them, the run would use
   part 0 and drop the rest with no error. All datasets should concatenate their parts, as the
   `target` path already does.

3. **Validate IDs and schema up front.** Several ontology IDs are pinned and could be
   obsoleted across releases: the alias allow-list (four MONDO IDs), `MEASUREMENT_AREA`
   (`EFO_0001444`), `PROCESS_AREA` (`GO_0008150`). Expected columns are also assumed. A
   pre-run check should assert each ID still resolves and each expected column is present, and
   fail with a clear message rather than produce silently wrong output.

4. **Treat the consistency test as a release gate.** `tests/test_matcher.py` already pins a set
   of known recoverable pathways and known traps. It should run against the freshly built
   index before any output is written, and block the run on failure.

5. **Report coverage drift.** The template patterns are a fixed list. If Reactome changes a
   labelling convention, those pathways are missed silently. The run should record how many
   labels matched each template and each method, so a drop between releases is visible.

None of this changes the method. It makes the existing method safe to run without a human
watching each release.

## LLM judge for context false positives

Built (`src/dispathcuration/judge.py`, `scripts/run_judge.py`). The judge removes matches where
a disease token appears in the label for a reason unrelated to the disease: "hypoxia" as a
cellular condition rather than the disease, "dependence" as a receptor property, an acronym
that means a protein here. These are linguistic false positives the deterministic matcher
cannot see, because it has no context model.

On release 26.06 it rejected 13 of the 151 low-confidence candidates, including `hypoxia` in
"Cellular response to hypoxia", `dependence` in "Dependence Receptors", and `viral infection`
in "Viral Infection Pathways".

### Backend: Claude Code, no API key

`claude_code_backend` shells out to the Claude Code CLI in print mode
(`claude -p --model <model> --output-format json`), which uses the user's existing Claude Code
login. No ANTHROPIC_API_KEY is required. The backend is a single function passed into
`judge_matches`, so a direct Anthropic API call can replace it later without touching the rest
of the module. The default model is Haiku, which keeps the small tier cheap; Opus judges more
strictly and can be passed with `--model opus`.

### Shape: an annotating filter, not a matcher

The judge never proposes matches. It takes existing candidate matches and labels each keep or
reject. It adds a column to the candidate table; it does not delete rows. The deterministic
candidate table stays the reproducible core, and the judge is a layer on top that can be
re-run, audited, or ignored.

### Which candidates it sees

Only the low-confidence tier: the `alias` method, and `whole_form` matches below a specificity
threshold. Template matches are structurally certain (the label states the disease is caused),
so they are not sent, and the judge is never allowed to override them. This confines cost and
non-determinism to roughly the alias-plus-borderline pairs, not the whole output.

### Interface

Per candidate the judge receives:

- the pathway label,
- the matched disease name,
- the exact span in the label that matched.

Candidates are sent in batches, and the judge returns a JSON array, one object per item:

- `verdict`: `keep` or `reject`,
- `reason`: one clause, for audit.

The prompt asks a single question: does the label refer to this disease, or does the matched
text mean something else here? It is told to judge language only, not pathway biology.

### Automation and reproducibility

- The call is a Python step over the candidate table, batched.
- Results are cached keyed on a hash of `(pathway label, disease id, matched span)`. Unchanged
  pairs cost nothing on re-run, and the annotated output is stable across releases except where
  a label or match actually changed.
- Model choice is a cost decision made at build time. The tier is small, so a fast model
  (Claude Haiku 4.5) is the default; a stronger model can be swapped in for a sampled audit.

### Validating the judge itself

The pairs that recover curated Reactome evidence are known true positives. Running the judge
over them measures its false-reject rate directly: any recovered-evidence pair the judge
rejects is a judge error. This turns the evidence set into a validation harness for the judge,
and gives a number to watch when the model or prompt changes.

### Caveats

- It adds an API dependency and non-determinism to an otherwise offline, deterministic
  pipeline. Keeping it as an annotating layer over a stable candidate table contains this.
- It sees only the label, so it catches linguistic false positives, not biological ones. That
  is the intended scope.
- It must not see or override template matches, or it would trade certain signal for model
  judgement.

## Universality boundary

For a later generalisation beyond Reactome, the layers split cleanly:

- Universal, reusable unchanged: the disease chunk index, the `whole_form` and `alias`
  extractors, and the LLM judge.
- Reactome-specific: the `template` extractor and the evidence comparison.

Generalising to GO or another label source means making the label source and the active
extractor set a configuration choice, then supplying a source-appropriate baseline. The
`Matcher` already runs extractors independently, so this is a wiring change, not a redesign.
