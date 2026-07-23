# Matching disease names in pathway labels

This note documents the matcher: the three extractors it runs, why each exists, the
considerations behind their filters, and how the output compares to the curated Reactome
evidence. All numbers are from release 26.06 over the 2,870 Reactome pathway labels.

The companion note [chunking.md](chunking.md) covers how diseases become searchable chunks.
This note is about turning those chunks into pathway-disease matches.

## The three extractors

A pathway-disease pair is emitted once, labelled with the strongest method that produced it.
Precedence is template, then whole-form, then alias.

| Method | What it matches | Pairs | Precision stance |
| --- | --- | ---: | --- |
| `template` | disease slot of a "causes" label | 72 new + recovered | highest |
| `whole_form` | a complete disease name or synonym as a token span | 130 new + recovered | high |
| `alias` | a distinctive single disease token | reviewed | lowest, flag for review |

Global abbreviation matching is deliberately absent. Tested against the evidence it recovered
10 links while adding 61 acronym collisions, a 6:1 loss. The template and alias mechanisms
recover the same genuine cases without that cost.

### 1. Template extractor

Reactome labels follow fixed templates, and the disease slot is a disease by construction:

```
Defective GENE causes DISEASE
GENE variants cause DISEASE
GENE deficiency causes DISEASE
```

This structural fact licenses matching a disease that appears only as an abbreviation. `PXE`
in `Defective ABCC6 causes PXE` is trusted because the template proves the slot is a disease;
the same three letters free-floating would not be. Slot resolution prefers the spelled-out
name over an acronym, so `Defective SLC26A4 causes Pendred syndrome (PDS)` resolves through
`pendred syndrome` (one disease) rather than the ambiguous `PDS` (two).

### 2. Whole-form extractor

A complete disease name or exact synonym found as a contiguous token span. Fragments are
never matched: `type 2` and `diabetes` do not fire, only `type 2 diabetes mellitus`. Generic
one-word names are held back by a specificity floor, which keeps `hyperargininemia` and drops
`fibrosis`. See [chunking.md](chunking.md) for the coverage and specificity mechanics.

### 3. Alias extractor

A distinctive single disease token that appears without a template, such as `HIV` in
`Uncoating of the HIV Virion`. This is the riskiest extractor and is filtered hardest. Two
sources are combined:

- Auto-derived long words: at least six characters, not a gene symbol, the whole name of one
  disease, shared across at most 15 diseases. This admits `influenza`, `leishmaniasis`,
  `citrullinemia` and rejects `cancer` (shared by 521) and `infection` (247).
- A reviewed allow-list of short acronyms mapped explicitly to one disease: `hiv`, `sars`,
  `hse`, `msud`.

The allow-list exists because short acronyms cannot be auto-trusted. The candidate acronyms
that fire on Reactome labels are dominated by biology, not disease:

```
ips  -> induced pluripotent stem cells   (not "ichthyosis prematurity syndrome")
abc  -> ABC transporters                 (not "aneurysmal bone cyst")
can  -> the English word "can"           (not "Crouzon-acanthosis nigricans")
spms -> pro-resolving mediators          (not "secondary progressive MS")
npc  -> nuclear pore complex             (not "nasopharyngeal carcinoma")
```

`hiv` is in the allow-list for a second reason: it never appears as a whole disease name in
EFO, only as a fragment of `HIV infectious disease`, so the index cannot supply it and the
mapping is given directly.

## Considerations behind the filters

Each filter was chosen against the data, not from first principles.

1. **Sharing beats specificity for aliases.** A single specificity floor cannot separate a
   distinctive token from a generic one: `hiv` (7.6) scores below the generic `toxicity`
   (6.9). Corpus sharing does separate them: `hiv` is shared by 11 diseases, `cancer` by 521.

2. **Gene symbols are the main collision source.** Cross-checking against the 77,084 approved
   symbols in the `target` dataset removes `amn`, `kit`, `flt3`, `erbb2`, the tokens that
   drove most spurious fragment matches.

3. **Length three is the danger zone.** Two-letter acronyms (`HD`, `AS`) are never matched.
   Three-letter acronyms are biology collisions often enough that they are admitted only
   through the allow-list.

4. **Process terms are not diseases.** 735 disease-dataset rows sit under GO biological_process
   (`cell cycle`, `metabolic process`, `transport`). They are excluded at load time, which
   stops matches such as `Surfactant metabolism -> metabolic process`.

## Recovery against curated Reactome evidence

The evidence is a recall floor, not a ceiling: the premise of the project is that it is
incomplete. Over its 653 pathway-disease pairs:

| Outcome | Count | Share |
| --- | ---: | ---: |
| Recovered, exact same disease | 88 | 13.5% |
| Recovered, matcher more specific | 28 | 4.3% |
| Recovered, matcher more general | 6 | 0.9% |
| Not recovered | 531 | 81.3% |
| **Recovered, total** | **122** | **18.7%** |

The matcher also emits 263 pairs absent from the evidence: the candidate output for the
undercuration question.

The 18.7% is not a defect. It is a property of the evidence, established in
[chunking.md](chunking.md): most curated links sit on pathways whose label does not name the
disease, so no label-based method can reach them.

## Reasons for non-recovery

The 531 not-recovered pairs split into two reasons.

| Reason | Count | Reachable by a label method? |
| --- | ---: | --- |
| Label names no disease | 450 | No |
| Matcher named a different disease | 81 | Partly |

**Label names no disease (450).** The label describes biology and never names the curated
disease, which is overwhelmingly a broad term the curator assigned from pathway knowledge:

```
"CTNNB1 S37 mutants aren't phosphorylated"  curated = cancer
"Signaling by ERBB2 ECD mutants"            curated = cancer
"RAS signaling downstream of NF1 loss"      curated = cancer
```

**Matcher named a different disease (81).** The matcher found a disease on the pathway, but
not the curated one. Many of these are the matcher being more precise than the curation, where
the ontology graph does not link the specific term to the broad curated term, so the recovery
check cannot count it automatically.

## Where the matcher improves on curation: added specificity

A recurring pattern is worth separating out, because it is a positive result rather than a
miss. When a template names a specific subtype, the matcher extracts it, while the curated
evidence records a parent. These are the 28 "more specific" recoveries, plus a share of the 81
"named a different disease" cases where the ontology link is absent:

```
"Defective NEU1 causes sialidosis"      matcher = sialidosis            curated = Lysosomal disease
"Defective UGT1A4 causes hyperbili..."  matcher = Hyperbilirubinemia    curated = Crigler-Najjar syndrome
"Defective B4GALT1 causes B4GALT1-CDG"  matcher = B4GALT1-CDG           curated = congenital disorder of glycosylation
```

In each, the label states the precise disease and the matcher recovers it, so the pipeline can
propose tightening the curated annotation, not just adding new ones. This is a distinct,
useful output alongside the missing-link candidates.

## What this means for the pipeline

Label matching and manual curation are complementary, not nested. The matcher produces two
actionable outputs:

- New candidate links: pathways whose label names a disease that has no curated evidence
  (263 pairs).
- Specificity improvements: pathways whose curated disease is broader than the one the label
  names (the more-specific recoveries).

Neither is measured against a 100% recall target, which the evidence structure makes
unreachable. Both are measured by precision on manual review of a sample, and the `alias`
method in particular is flagged as the one most needing that review.

## Reproducing

```
python scripts/build_disease_index.py   # disease chunks
python scripts/run_matcher.py           # matches + recovery report
pytest tests/test_matcher.py            # recovery consistency
```
