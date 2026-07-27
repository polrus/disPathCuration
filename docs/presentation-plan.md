# Presentation plan: automatic disease-pathway curation

A 10-minute talk. Detailed slide-by-slide description with the numbers and examples to use.
All figures are from Open Targets Platform release 26.06. Build the deck from this later.

Target length: ~11 slides, roughly 1 minute each. Numbers in **bold** are the headline figures
for that slide.

---

## Slide 1 - The problem

**Message:** Open Targets target-disease evidence from Reactome depends on manual curation of
which pathways belong to which disease, and that curation is incomplete.

Talking points:
- Open Targets derives target-disease evidence from Reactome pathways: a gene in a
  disease-annotated pathway becomes evidence for that gene-disease association.
- Whether a pathway is linked to a disease is decided by manual curation.
- Working hypothesis: **disease pathways are undercurated.** Many Reactome pathways name a
  disease directly in their label, yet produce no target-disease evidence.
- If true, the missing links can be recovered automatically from data Open Targets already
  ships, with no new experiments.

Visual: a Reactome pathway whose label names a disease, with an arrow to "no OT evidence?"
Example to show: `Defective ABCC6 causes PXE` (pseudoxanthoma elasticum) sitting in a pathway
library, unlinked.

---

## Slide 2 - Pipeline schema (approximate)

**Message:** one deterministic pipeline, four stages, plus an optional LLM verification.

Reuse the mermaid diagram from the README. Stages:
1. Inputs: Open Targets `disease` (EFO/MONDO), `target` (genes), `reactome` (pathway labels),
   `evidence_reactome` (curated baseline).
2. Disease chunk index: turn every disease into scored, searchable text chunks.
3. Matcher: three extractors find disease names in pathway labels
   (`template` > `whole_form` > `alias`).
4. LLM judge (optional): remove context false positives.
5. Evaluation: compare against curated evidence; emit new candidates and specificity fixes.

Note which layers are Reactome-specific (the `template` extractor and the evidence comparison)
versus universal (everything else). This sets up the "universal pipeline" point in the
conclusion.

---

## Slide 3 - Processing disease IDs into chunks

**Message:** whole disease names almost never appear verbatim in a pathway label, so we match
on scored sub-spans, and most sub-spans are worthless unless we score them.

Numbers:
- Start from the full EFO/MONDO `disease` dataset: **47,080** terms.
- Drop non-diseases: **25,049** measurement terms (GWAS traits like "Increased circulating
  ACTH level", EFO_0001444) and **735** biological_process terms ("cell cycle", "metabolic
  process", GO_0008150). Leaves **21,296** real diseases.
- Expand to **79,582** surface forms (name + exact synonyms, normalised), then **249,260**
  distinct chunks.

Two scores per chunk (this is the key idea):
- **specificity** = summed inverse document frequency of its tokens. High for a rare full name.
- **coverage** = share of the surface form's information the chunk carries. 1.0 = the whole
  name.

Chunk examples table (show these, they make the point instantly):

| Disease | Chunk | specificity | coverage | shared by | kept? |
| --- | --- | ---: | ---: | ---: | --- |
| type 2 diabetes mellitus | diabetes mellitus noninsulin dependent | 38.6 | 1.00 | 1 | keep |
| type 2 diabetes mellitus | type 2 | 5.0 | 0.30 | 492 | drop |
| type 2 diabetes mellitus | 2 | 3.3 | 0.20 | 809 | drop |
| Pendred syndrome | genetic defect in thyroid hormonogenesis | 32.8 | 1.00 | 1 | keep |
| Pendred syndrome | deafness | 4.4 | 0.30 | 253 | drop |
| cystic fibrosis | pseudomonas aeruginosa susceptibility... | 50.8 | 1.00 | 1 | keep |
| cystic fibrosis | infection | 4.5 | 0.09 | 247 | drop |

Point: `type 2` is shared by 492 diseases, `2` by 809. Without scoring, matching drowns in
generic fragments. Specificity plus coverage keeps only whole, informative names.

Normalisation caveats worth one line: Greek letters expanded (alpha), diacritics stripped,
possessives folded (`Parkinson's` -> `parkinson`), Roman numerals resolved in context.

---

## Slide 4 - Curating pathways from Reactome: three extractors

**Message:** three complementary matchers, in order of precedence, each with a clear precision
rationale.

Extractor 1, **template** (highest precision). Reactome labels follow fixed patterns where the
disease slot is a disease by construction: `Defective GENE causes DISEASE`. This licenses an
acronym the structure proves is a disease.
- `Defective SLC26A4 causes Pendred syndrome (PDS)` -> Pendred syndrome
- `Defective B4GALT1 causes B4GALT1-CDG (CDG-2d)` -> B4GALT1 congenital disorder of glycosylation
- `Defective SLC5A2 causes renal glucosuria (GLYS1)` -> Renal glucosuria

Extractor 2, **whole_form**. A complete disease name or exact synonym as a contiguous span.
Fragments never match.
- `Defective SLC2A10 causes arterial tortuosity syndrome` -> arterial tortuosity syndrome
- `Defective SLC24A5 causes oculocutaneous albinism 6` -> oculocutaneous albinism
- `Defective AVP ... causes neurohypophyseal diabetes insipidus` -> neurohypophyseal diabetes insipidus

Extractor 3, **alias** (lowest confidence, hardest filtered). A distinctive single disease
token. Filtered against gene symbols (from the `target` dataset), corpus sharing, and a
reviewed allow-list for short acronyms.
- `Abortive elongation of HIV-1 transcript...` -> HIV infectious disease
- `Defective SERPING1 causes hereditary angioedema` -> angioedema
- `Defective ABCG8 causes GBD4 and sitosterolemia` -> sitosterolemia

Key design point to state: **global abbreviation matching is deliberately excluded.** Tested,
it recovered 10 curated links but added 61 acronym collisions (e.g. `HD` matching Huntington
disease inside "NOTCH1 HD Domain"), a 6:1 loss. Template and alias recover the genuine cases
without that cost.

Matcher output: **351** pathway-disease pairs (whole_form 171, alias 95, template 85).

---

## Slide 5 - Optional LLM judge (last pipeline step before results)

**Message:** a language model removes context false positives the deterministic matcher cannot
see, as an annotating layer that never overrides certain matches.

Design:
- Runs only on the low-confidence tier: `alias` and low-specificity `whole_form`
  (**151 of 351** matches). `template` matches are structurally certain and never sent.
- Annotates each with keep or reject plus a reason. It never deletes rows; the deterministic
  table stays the reproducible core.
- Judges word sense only: reject when the matched text means something else here (a protein, a
  domain, a verb); keep genuine disease references even if broad.
- No API key needed: runs through the Claude Code CLI in print mode. Batched and cached.

Result on 26.06: **6 of 151 rejected.** Examples of correct rejections (wrong sense):

| Pathway label | Matched | Why rejected |
| --- | --- | --- |
| Caspase activation via Dependence Receptors | dependence | a receptor-family term, not substance dependence |
| Defective POMGNT1 causes MDDGA3, MDDGB3... | mddgc3 | acronym for a different subtype than the label names |
| Defective SLC1A3 causes episodic ataxia 6 | episodic ataxia | matcher mapped to a different ataxia |
| SARS-CoV-2 activates innate immunity | sars | SARS-CoV-2 causes COVID-19, not SARS |

And correct keeps (broad but valid, to show it does not over-reject):

| Pathway label | Matched | Kept as |
| --- | --- | --- |
| Viral Infection Pathways | viral infection | viral infectious disease |
| Dengue Virus Infection | dengue virus infection | dengue disease |
| Early SARS-CoV-2 Infection Events | cov 2 infection | COVID-19 |

One honest caveat to mention: borderline cases like `hypoxia` in "Cellular response to hypoxia"
are kept under the "keep broad-but-correct" rule; the judge biases toward recall.

---

## Slide 6 - Results: new links added

**Message:** the pipeline surfaces a large set of disease-pathway links absent from current
curation, and each expands to gene-level evidence.

After the judge keeps **345** pathway-disease pairs, of which:
- **258 are new** (absent from curated Reactome evidence),
- across **190 distinct pathways** and **175 distinct diseases**.

Expanding each new link to gene-level via pathway membership (Open Targets `target.pathways`):
- **~600 to 930 new target-disease pairs.**
- Be honest about the range on the slide. The median new pathway carries 1 gene (so most links
  add 1 pair), but a few gene-rich pathways dominate the tail: "Potential therapeutics for
  SARS" (154 genes), "MLL4/MLL3 complexes" (134), "SARS-CoV-2 modulates host translation" (51).
  Raw expansion = 930; excluding pathways with more than 50 genes = ~580.
- Present the robust headline as **258 new pathway-disease links -> roughly 600 to 900 new
  target-disease pairs**, not a single inflated figure.

Visual suggestion: a bar or funnel: 351 matches -> 345 kept -> 258 new links -> ~600 to 900
target-disease pairs.

---

## Slide 7 - Validation against Reactome curation: recovery

**Message:** we reproduce the curated evidence where the label actually names the disease, and
the shortfall is expected, not a defect.

Numbers, over the **653** curated pathway-disease pairs:
- Recovered: **122 (18.7%)** = 88 exact + 28 more specific + 6 more general.
- Not recovered: **531**.

State clearly, because the number looks low: **label matching and manual curation are
complementary, not nested.** Curators assign diseases from pathway biology, not label text, so
most curated links name no disease in the label and are unreachable by any label method. The
18.7% is a property of the evidence, not a weakness of the method. The right denominator is the
label-nameable subset, not all 653.

Set this up as the bridge to the next slide: "so why are the other 531 not recovered?"

---

## Slide 8 - Why curated links are not recovered (one example per reason)

**Message:** the non-recovery is almost entirely cases no label method could reach, plus a few
where our answer is actually better.

Reason A - **label names no disease at all** (the large majority). The label is pure biology;
the curated disease is a broad term assigned from gene knowledge.
- `Signaling by plasma membrane FGFR1 fusions` -> curated: cancer
- `brigatinib-resistant ALK mutants` -> curated: cancer
- `Signaling by high-kinase activity BRAF mutants` -> curated: cardiofaciocutaneous syndrome
- `Hh mutants are degraded by ERAD` -> curated: holoprosencephaly

Reason B - **disease named only by an acronym that collides** (correctly refused). Turning on
free acronym matching would recover these but at 6:1 false positives.
- `Constitutive Signaling by NOTCH1 HD Domain Mutants`: `HD` here is the HD domain, but as an
  acronym collides with Huntington disease. Curated disease is cancer.

Reason C - **matcher named a different, often more precise disease** (not a miss, a
disagreement). The ontology graph does not always link the specific term to the broad curated
one.
- `MyD88 deficiency (TLR5)`: matcher = pyogenic bacterial infection; curated = inborn error of
  immunity (a broad parent).
- `Defective POMT2 causes MDDGA2...`: matcher = muscular dystrophy-dystroglycanopathy; curated =
  neuromuscular disease (broad parent).

This slide should make the point: strip out A and B (unreachable / correctly refused) and the
true "should have recovered but did not" set is small.

---

## Slide 9 - Bonus: increasing the specificity of Reactome curation

**Message:** where a label names a precise subtype, the pipeline recovers it, while the curated
evidence recorded only a broad parent. So the pipeline does not only add links, it tightens
existing ones.

**44** such specificity improvements. Examples (matcher term vs curated term):

| Pathway label | Matcher (specific) | Curated (broad) |
| --- | --- | --- |
| Defective B4GALT1 causes B4GALT1-CDG | B4GALT1-congenital disorder of glycosylation | congenital disorder of glycosylation type II |
| Defective SLC24A5 causes oculocutaneous albinism 6 | oculocutaneous albinism type 6 | oculocutaneous albinism |
| Defective PMM2 causes PMM2-CDG | PMM2-congenital disorder of glycosylation | congenital disorder of glycosylation type I |
| Defective CHST14 causes EDS, musculocontractural type | Ehlers-Danlos syndrome, musculocontractural type | Ehlers-Danlos syndrome |

Point: this is a second, distinct output type. It proposes tightening the annotation, not just
adding new ones, and it is directly actionable by curators.

---

## Slide 10 - Conclusion: benefits of integrating this pipeline

**Message:** meaningful new evidence, from data already in Open Targets, with a method that
generalises, and a demonstrated real-world need.

Points to land:
1. **Scale of new evidence.** 258 new pathway-disease links -> roughly 600 to 900 new
   target-disease pairs, plus 44 specificity improvements, from Reactome alone.
2. **No new data required.** Everything comes from datasets Open Targets already ships (disease,
   target, reactome, evidence_reactome). This is recovering signal already present, not adding a
   new source.
3. **Expandable to GO now.** The chunk index and whole_form/alias extractors are source-agnostic;
   pointing them at GO biological-process labels is a configuration change, not a redesign.
4. **Universal for future gene sets.** As Open Targets integrates new pathway or gene-set
   resources, the same pipeline applies with no method change. Only the template layer and the
   comparison baseline are source-specific.
5. **Demonstrated unmet need.** The value was already shown in two Open Targets experimental
   projects, Neuroflux and Neuroid, where disease-pathway coverage was a limiting factor. This
   establishes that the gap is real and that automating its recovery is worth integrating.

Optional extra points if time allows:
- Fully reproducible and deterministic core; the LLM judge is an optional, cached, auditable
  layer.
- Precision-first design throughout (strict rules, exclusions, gene-symbol filtering), so
  candidates are curator-ready rather than a noisy long list.
- Runs per platform release once the release-resolver and schema checks are added
  (see docs/pipeline.md).

---

## Data and figures reference (for building the deck)

Release: 26.06. Regenerate with `scripts/run_matcher.py` and `scripts/run_judge.py`.

- Diseases after filtering: 21,296 (from 47,080; dropped 25,049 measurement + 735 process).
- Surface forms: 79,582. Distinct chunks: 249,260.
- Matcher output: 351 pairs (whole_form 171, alias 95, template 85).
- Judge: 151 low-confidence candidates, 6 rejected, 345 kept.
- New pathway-disease links: 258, over 190 pathways and 175 diseases.
- New target-disease pairs: 930 raw expansion, ~580 excluding pathways >50 genes. Present as
  "roughly 600 to 900". Median genes per new pathway = 1.
- Recovery of curated evidence: 122/653 (18.7%): 88 exact, 28 more specific, 6 more general;
  531 not recovered.
- Specificity improvements: 44.
- Output files (CSV): matches.csv, matches_judged.csv, new_candidates.csv, specificity_fixes.csv
  in data/26.06/.

Caveats to keep honest on the slides:
- Target-disease count is a range, skewed by a few large pathways; do not present a single
  figure.
- 18.7% recovery is by design; frame as complementary, not a failure.
- The alias method and the judge keep borderline broad matches (e.g. hypoxia); flag as the tier
  most needing curator review.
- Neuroflux and Neuroid are cited as demonstrating the need; use only as the user described, no
  invented specifics.
