# Presentation plan: automatic disease-pathway curation

A 10-minute talk. Detailed slide-by-slide description with the numbers and examples to use.
All figures are from Open Targets Platform release 26.06. Build the deck from this later.

Target length: ~15 slides, roughly 1 minute each. Numbers in **bold** are the headline figures
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

## Slide 10 - Extending to GO biological processes

**Message:** the pipeline runs on GO through the same code, but GO is a different kind of source,
and the results and applicable steps differ. This is the universality claim, tested.

Numbers:
- GO biological_process, non-obsolete: **24,136 labels** (of 30,874; ~10k obsolete dropped).
- Matches: **165 pathway-disease pairs** over **15 distinct diseases** (138 whole_form,
  27 alias, **0 template**).
- After the judge (Sonnet): **141 kept, 24 rejected**.

Examples of GO pathways found (show these):
- `type III hypersensitivity` -> `IgE responsiveness, atopic` (via the exact synonym
  "type III hypersensitivity"; a good illustration of synonym matching)
- `granuloma formation` -> `Granuloma`
- `response to hypoxia` -> `hypoxia`
- `inflammatory response to antigenic stimulus` -> `inflammation`
- `reactive gliosis` -> `Gliosis`

Which pipeline parts were NOT used for GO (the Reactome-specific layers):
- **`template` extractor**: 0 matches. GO has no "Defective GENE causes DISEASE" labels, so the
  highest-precision extractor does not apply and is switched off.
- **Recovery / evaluation against curated evidence**: there is **no GO-disease evidence dataset**
  in Open Targets, so there is no baseline to compute recovery, non-recovery or specificity
  fixes. Every GO match is reported as a candidate.
- **Gene membership** comes from a different field: `target.go` (aspect P) instead of
  `target.pathways`.

The key qualitative finding to state: **GO describes processes, not disease pathways.** Only
**0.3%** of GO labels carry any disease cue, so GO yields fewer and noisier matches than
Reactome, concentrated on a handful of process-condition overlaps (inflammation, hypoxia,
hypersensitivity). Consequence: the LLM judge rejected **24 of 77** low-confidence GO candidates
(31%) versus **11 of 151** on Reactome (7%). On GO the judge is essential, not optional, and GO
output should be treated as review-first rather than curation-ready.

---

## Slide 11 - Judge model comparison: Haiku, Sonnet, Opus

**Message:** the deterministic core is reproducible; the judge is the one non-deterministic
layer, so we measured three models against each other and against curated evidence.

Model pricing (Anthropic API, USD per 1M tokens), for the cost/quality tradeoff:

| Model | Input $/1M | Output $/1M |
| --- | ---: | ---: |
| Claude Haiku 4.5 | 1.00 | 5.00 |
| Claude Sonnet 5 (default) | 3.00 (2.00 intro to 2026-08-31) | 15.00 (10.00 intro) |
| Claude Opus 4.8 | 5.00 | 25.00 |

The judge tier is small (151 + 77 candidates, batched, cached), so absolute cost is low at any
model; the point of the table is the ~5x span from Haiku to Opus when this scales to more
sources or every release.

Reactome (151 low-confidence candidates judged):

| Model | Rejects | False rejects vs curated evidence |
| --- | ---: | ---: |
| Haiku | 6 | 2 |
| Sonnet (default) | 11 | 1 |
| Opus | 8 | 1 |

All three agree on **137/151 (91%)**. Disagreements fall on two ambiguous classes only:
- **SARS-CoV-2 pathways matched to "severe acute respiratory syndrome"** via the alias `sars`.
  SARS-CoV-2 causes COVID-19, not SARS, so rejecting is arguably more correct. Sonnet rejects
  most of these; Haiku keeps almost all. Example: `SARS-CoV-2 Infection` -> SARS,
  Haiku=keep, Sonnet=reject, Opus=keep.
- **`hypoxia` as a molecular process vs the disease.** Sonnet and Opus reject
  `Oxygen-dependent proline hydroxylation` -> hypoxia and `Regulation of gene expression by
  hypoxia` -> hypoxia (HIF pathways); Haiku keeps them.

GO (77 low-confidence candidates judged):

| Model | Rejects |
| --- | ---: |
| Haiku | 37 |
| Sonnet (default) | 24 |
| Opus | 21 |

All three agree on **60/77 (78%)**. Here the strictness order flips: **Haiku is strictest on
GO**, Opus most lenient. The clearest disagreement, with the actual model reasons, worth showing
verbatim on the slide:

`cardiac muscle hypertrophy` matched to the disease `Skeletal muscle hypertrophy`
(via the disease's exact synonym "Muscle hypertrophy"):
- Haiku = **reject**: "cardiac muscle hypertrophy is distinct from skeletal muscle hypertrophy;
  label specifies cardiac not skeletal"
- Sonnet = **keep**: "hypertrophy sense matches, tissue site differs but not word sense"
- Opus = **keep**: "same word sense; cardiac rather than skeletal tissue"

This is a genuine judgement split: Haiku treats tissue specificity as disqualifying; Sonnet and
Opus treat it as the same word sense with a different site. For disease-pathway curation Haiku's
stricter reading is arguably better, but there is no GO baseline to settle it, which is the
point: on GO, model choice is a real curation decision.

Takeaways for the slide:
- No model is uniformly strictest. Sonnet/Opus are stricter on Reactome's ambiguities
  (SARS, hypoxia); Haiku is stricter on GO's tissue mismatches.
- The real safeguard is not the model but the false-reject check against curated evidence, plus
  human review of the retained reject list.

### The case where the judge beat Open Targets' own mapping

All three models rejected `Defective SLC1A3 causes episodic ataxia 6 (EA6)` ->
`Isaacs syndrome`. This looks like a false reject against curated evidence, because Open Targets
evidence contains that exact pair. But Open Targets' evidence made the same error: its
`diseaseFromSource` was "episodic ataxia", mapped to Isaacs syndrome.

Root cause, traced to the ontology: the EFO term **EFO_1000638** (Isaacs syndrome, which is
neuromyotonia, dbXRefs DOID:963 / MESH:D020386 / Wikipedia:Neuromyotonia) carries
**"episodic ataxia" as a spurious exact synonym**. Both our matcher and Open Targets' mapping
followed that bad synonym; the judge caught it. The correct disease, hereditary episodic ataxia
(MONDO_0016227), was kept for the same pathway.

Point to land: the judge does more than filter label noise. It disambiguates and, as a
byproduct, surfaces ontology data-quality errors that are actionable upstream. This is an EFO
curation fix (editable at http://www.ebi.ac.uk/efo/EFO_1000638), and the judge's reject list is
effectively a candidate list of such synonym errors.

---

## Slide 12 - Scaling out: all public pathway libraries via Enrichr

**Message:** the same pipeline applied to the whole landscape of public pathway libraries, not
just Open Targets. This is the universality claim taken to its full extent.

How the libraries were chosen:
- Enrichr catalogs **228 gene-set libraries**. We took the curated Pathways category, the
  latest version of each library, and excluded Reactome and GO (already covered via Open
  Targets) and mouse variants (mouse gene symbols do not map to human targets). Result:
  **12 libraries**.
- Key practical advantage: each Enrichr library ships term labels **and** gene sets in one GMT
  file, so gene membership is free, with no target-to-pathway join. Gene symbols are HGNC,
  already compatible with the pipeline's gene-symbol filter.

The 12 libraries (what each is):

| Library | What it is |
| --- | --- |
| KEGG_2026 | Kyoto Encyclopedia of Genes and Genomes; curated metabolic, signalling and human-disease pathways |
| WikiPathways_2024_Human | community-curated biological pathways |
| Elsevier_Pathway_Collection | commercially curated disease-mechanism and signalling pathways (Pathway Studio) |
| BioPlanet_2019 | NCATS BioPlanet; integrated, deduplicated collection of human pathways |
| BioCarta_2016 | legacy hand-drawn signalling pathway maps |
| NCI-Nature_2016 | NCI-Nature Pathway Interaction Database; curated signalling pathways |
| Panther_2016 | PANTHER classification-system pathways |
| HumanCyc_2016 | curated human metabolic pathways (MetaCyc/HumanCyc) |
| PFOCR_Pathways_2023 | Pathway Figure OCR; gene sets mined from published figures |
| MSigDB_Hallmark_2020 | 50 hallmark gene sets summarising coherent biological states |
| MSigDB_Computational | computationally derived cancer gene modules |
| MSigDB_Oncogenic_Signatures | gene sets from oncogenic pathway perturbations |

---

## Slide 13 - Enrichr results: disease pathways found across libraries

**Message:** one deterministic pass plus the judge, across 12 libraries, yields a large curated
candidate set, and the extraction itself taught us where label matching does and does not apply.

Numbers:
- **1,144 disease-pathway matches** before the judge, **1,118 kept** after (26 rejected, **2.3%**).
- **349 distinct diseases**, expanding to **~36,700 deduplicated target-disease pairs**.
- The 2.3% reject rate is Reactome-like (low), not GO-like (31%). These libraries use proper
  disease-named labels, not process descriptions, which confirms the source-type distinction:
  the judge matters most where labels describe processes.

Per library (judge-kept), one example each:

| Library | Kept | Target-disease | Example |
| --- | ---: | ---: | --- |
| Elsevier | 737 | 19,208 | "Oxidative Stress in Amyotrophic Lateral Sclerosis" -> ALS |
| WikiPathways | 179 | 8,648 | "Smith-Magenis and Potocki-Lupski Syndrome" -> Potocki-Lupski syndrome |
| KEGG | 88 | 10,874 | "Arrhythmogenic right ventricular cardiomyopathy" -> ARVC |
| BioPlanet | 91 | 4,249 | "APOBEC3G-mediated resistance to HIV-1" -> HIV-1 infection |
| BioCarta | 13 | 258 | "Reversal of Insulin Resistance by Leptin" -> insulin resistance |
| Panther | 5 | 374 | "Parkinson disease" -> Parkinson disease |
| NCI-Nature | 3 | 101 | "HIV-1 Nef: negative effector of Fas" -> HIV infectious disease |
| MSigDB_Hallmark | 2 | 400 | "Inflammatory Response" -> inflammation |

What the extraction taught us (lessons):
- **The biggest library is not label-matchable.** PFOCR (21,845 terms) yields zero: its terms
  are PMC figure IDs (`PMC102186 F9`), not pathway names. Label matching simply does not apply.
- **Metabolic and module libraries name no diseases.** HumanCyc (metabolic) and MSigDB
  Computational/Oncogenic (gene-module IDs) also yield zero, correctly.
- **Disease-mechanism libraries dominate.** Elsevier alone contributes 737 of the 1,118 kept,
  because its naming convention is "X in Disease Y".
- **Gene membership came for free** from the GMT files, unlike Open Targets where it required a
  target-to-pathway join.
- **The judge caught subtle context errors** the string matcher cannot: protein names (CFTR,
  DSCAM, hypoxia-inducible factor), word senses (long-term depression, sterile inflammation,
  glutamate overdose), and SARS-CoV-2 versus SARS.

Take-away for the slide: the pipeline generalises to any labelled pathway resource, and the
same source-type rule holds everywhere: named-disease labels are high-yield and low-noise;
process or identifier labels are not.

---

## Slide 14 - Conclusion: benefits of integrating this pipeline

**Message:** meaningful new evidence, from data already in Open Targets, with a method that
generalises, and a demonstrated real-world need.

Points to land:
1. **Scale of new evidence.** 258 new pathway-disease links -> roughly 600 to 900 new
   target-disease pairs, plus 44 specificity improvements, from Reactome alone.
2. **No new data required.** Everything comes from datasets Open Targets already ships (disease,
   target, reactome, evidence_reactome). This is recovering signal already present, not adding a
   new source.
3. **Already extended to GO and 12 public pathway libraries.** The pipeline runs on GO
   biological_process (165 matches, 141 kept) and on 12 curated Enrichr libraries (1,118 kept,
   ~36,700 target-disease pairs) through the same code, with only the Reactome-specific layers
   switched off. This is the universality claim, demonstrated across providers, not a promise.
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

Reactome:
- Matcher output: 351 pairs (whole_form 171, alias 95, template 85).
- Judge (Sonnet default): 151 low-confidence candidates, 11 rejected, 340 kept.
- New pathway-disease links: 258, over 190 pathways and 175 diseases.
- New target-disease pairs: 930 raw expansion, ~580 excluding pathways >50 genes. Present as
  "roughly 600 to 900". Median genes per new pathway = 1.
- Recovery of curated evidence: 122/653 (18.7%): 88 exact, 28 more specific, 6 more general;
  531 not recovered.
- Specificity improvements: 44.

GO biological_process:
- Labels (non-obsolete): 24,136 of 30,874. Matches: 165 (whole_form 138, alias 27, template 0),
  15 distinct diseases. Judge (Sonnet): 141 kept, 24 rejected. No curated baseline.
- Only 0.3% of GO labels carry a disease cue.

Judge model comparison (low-confidence candidates):
- Reactome (151): Haiku 6 reject, Sonnet 11, Opus 8; agree 137/151 (91%). False rejects vs
  curated evidence: Haiku 2, Sonnet 1, Opus 1.
- GO (77): Haiku 37 reject, Sonnet 24, Opus 21; agree 60/77 (78%).
- Ontology error caught: EFO_1000638 (Isaacs syndrome) has spurious exact synonym
  "episodic ataxia"; all three models reject it, Open Targets evidence contains the same error.
- Model pricing (USD per 1M tokens, input / output): Haiku 4.5 1.00 / 5.00; Sonnet 5 (default)
  3.00 / 15.00 (intro 2.00 / 10.00 to 2026-08-31); Opus 4.8 5.00 / 25.00.

- Output files: matches_<source>.csv, matches_judged_<source>.csv, new_candidates_<source>.csv,
  specificity_fixes_reactome.csv, and the unified disease_pathways_all.csv (source column), all
  in data/26.06/.

Caveats to keep honest on the slides:
- Target-disease count is a range, skewed by a few large pathways; do not present a single
  figure.
- 18.7% recovery is by design; frame as complementary, not a failure.
- The alias method and the judge keep borderline broad matches (e.g. hypoxia); flag as the tier
  most needing curator review.
- Neuroflux and Neuroid are cited as demonstrating the need; use only as the user described, no
  invented specifics.
