# Talk script: automatic disease-pathway curation

A build-ready script for a ~13-slide talk (12 to 15 with backup). Story spine:
**disease pathways are undercurated -> prove it and fix it on Reactome -> the same method
scales to every pathway library.** Problem, then solution, then results, then scale, then impact.

How to use this file: each slide has **On the slide** (what to show) and **Say** (the narration).
Keep slides visual; the numbers in bold are the ones to display. All figures are Open Targets
release 26.06 plus the Enrichr libraries. Detailed source figures live in
`docs/presentation-plan.md`; deeper methods live in `docs/matching.md`, `docs/chunking.md`,
`docs/pipeline.md`, and `docs/enrichr-report.md`.

Section arc: PROBLEM (1-2) -> SOLUTION (3-4) -> PROOF on Reactome (5-7) -> SCALE (8-10) ->
IMPACT (11-12) -> optional appendix.

---

## PROBLEM

### Slide 1 - Title

**On the slide:** Title ("Automatically recovering undercurated disease pathways"), your name,
Open Targets, date. One quiet background visual: a pathway whose label names a disease.

**Say:** "Open Targets links targets to diseases from many evidence sources. One of them,
Reactome, depends on people manually deciding which pathways belong to which disease. I am going
to argue that decision is incomplete, show how much is missing, and show a method that recovers
it automatically, from data we already have, across every pathway library."

### Slide 2 - The problem: disease pathways are undercurated

**On the slide:** The claim in one line: "Many pathways name a disease in their label yet
produce no target-disease evidence." One worked example: the Reactome pathway
`Defective ABCC6 causes PXE` with an arrow to "no Open Targets evidence?". A small note that
Reactome-derived evidence is only as complete as its manual curation.

**Say:** "Here is a Reactome pathway whose label literally says it causes pseudoxanthoma
elasticum. A curator has to connect that pathway to the disease for it to become evidence. When
they miss one, the gene-disease links inside that pathway never surface. Our hypothesis: this
happens a lot, and because the disease is often named right there in the label, we can find the
misses automatically. Everything that follows tests that hypothesis and then acts on it."

---

## SOLUTION

### Slide 3 - The approach in one picture

**On the slide:** The pipeline diagram (reuse the README mermaid): inputs (disease ontology,
targets, pathway labels, curated evidence) -> disease chunk index -> matcher (three extractors)
-> LLM judge -> outputs (new candidate links + specificity fixes). Mark which parts are generic
versus source-specific.

**Say:** "The method is four steps. Turn every disease into searchable text. Search pathway
labels for those disease names. Filter the matches with a language model that reads context.
Compare what we find to the existing curated evidence. Only one small part is Reactome-specific;
the rest is generic, which is why it later runs on any library."

### Slide 4 - How it works (lean)

**On the slide:** Three compact panels.
1. **Disease chunks:** whole disease names rarely appear verbatim (EFO names average 5.4 words),
   so score sub-spans by specificity and coverage; drop generic fragments like `type 2`.
2. **Three matchers:** `template` (Reactome "Defective GENE causes DISEASE", highest precision),
   `whole_form` (a full disease name or synonym), `alias` (a distinctive token like HIV, hard
   filtered). No fuzzy matching.
3. **LLM judge:** removes context false positives the string matcher cannot see; annotates, never
   deletes; only the low-confidence tier is judged.

**Say:** "Three things worth one sentence each. First, disease names are long and rarely appear
whole, so we match scored fragments and throw away generic ones like 'type 2' that would match
everything. Second, three matchers of decreasing confidence, no fuzzy matching, so a hit is a
real string. Third, a language model judge reads each low-confidence match in context and drops
the ones where the word means something else. Keep this slide short; the results are the point."

---

## PROOF (Reactome)

### Slide 5 - What we found in Reactome

**On the slide:** Headline: **258 new disease-pathway links** absent from curated evidence,
across **190 pathways** and **175 diseases**, expanding to **roughly 600 to 900 new
target-disease pairs**. A funnel: 2,870 labels -> 351 matches -> judge-kept -> 258 new links ->
target-disease pairs. Two or three example new links.

**Say:** "Running this on Reactome, we recover 258 disease-pathway links that are not in the
curated evidence, over 190 pathways and 175 diseases. Expanded through the genes in those
pathways, that is roughly 600 to 900 new target-disease pairs. Present it as a range, not a
single number, because a few large pathways dominate the count. These are candidates, from data
Open Targets already ships."

### Slide 6 - Does it agree with existing curation?

**On the slide:** Recovery against curated evidence: **122 of 653 curated pairs recovered
(18.7%)**. Then the honest framing in big type: "Label matching and manual curation are
complementary, not nested." One line: **450 of the not-recovered pairs name no disease in the
label at all** (curators used biology, e.g. `Signaling by ERBB2 mutants -> cancer`), so no
label method could reach them.

**Say:** "Now the obvious question: does this reproduce what curators already did? Partly, and
that is the right answer. We recover about 19 percent of curated pairs. The rest is not a
failure. In most of those cases the pathway label names no disease at all; the curator assigned
it from biology. No label-based method can find those, so the honest denominator is the
label-nameable subset. The two approaches are complementary. That is the key intellectual point
of the talk."

### Slide 7 - Bonus: we also sharpen existing curation

**On the slide:** Two results.
1. **44 specificity improvements:** the label names a precise subtype where curation recorded a
   parent (e.g. `Defective PMM2 causes PMM2-CDG` -> the specific CDG, not generic
   "congenital disorder of glycosylation").
2. **The judge caught an ontology error Open Targets itself inherited:** EFO term EFO_1000638
   (Isaacs syndrome, a neuromyotonia) carries a wrong synonym "episodic ataxia"; both our
   matcher and Open Targets' own evidence followed it; the judge rejected it.

**Say:** "Two bonuses. First, in 44 cases we do not just add a link, we tighten one: the label
names the exact subtype while the curation recorded a broad parent. Second, the judge caught a
mistake in the disease ontology itself. An EFO term for Isaacs syndrome carries a wrong synonym,
'episodic ataxia'. Both our pipeline and Open Targets' own evidence were fooled by it; the judge
flagged it. So the method also surfaces curation and ontology errors to fix upstream."

---

## SCALE (universal fix)

### Slide 8 - The same method generalises: GO

**On the slide:** "One config change, not a redesign." GO biological_process: **165 matches**
over 24,136 labels. The lesson: **only 0.3% of GO labels name a disease** (GO describes
processes), so GO is lower-yield and much noisier, and the judge rejects far more (about 31% of
the GO tier versus a few percent on Reactome). Source-type rule: named-disease labels are
high-yield; process labels are not.

**Say:** "Because most of the pipeline is generic, pointing it at GO is a configuration change.
GO taught us the rule that governs everything after: GO describes processes, not diseases, so
only a fraction of a percent of its labels name a disease. It yields less and is noisier, and
the judge does much more work there. Named-disease labels are the high-yield case; process
labels are not. Hold that rule for the next slide."

### Slide 9 - Scaling to all public pathway libraries (Enrichr)

**On the slide:** Enrichr hosts **228 gene-set libraries**. Selection: curated Pathways
category, latest version, excluding Reactome and GO (already covered) and mouse variants ->
**12 libraries**. A compact list with one-word descriptors (KEGG, WikiPathways, Elsevier,
BioPlanet, BioCarta, NCI-Nature, Panther, HumanCyc, PFOCR, three MSigDB). Advantage: each
library ships labels and gene sets in one file, so gene membership is free.

**Say:** "Then we went wide. Enrichr catalogs 228 gene-set libraries. We took the curated
pathway libraries, latest version of each, dropped Reactome and GO because we already had them,
and dropped mouse. Twelve libraries. A practical bonus: each library comes with its gene sets
built in, so the target-disease expansion is free, no join needed."

### Slide 10 - Enrichr results and what extraction taught us

**On the slide:** **1,144 matches, 1,118 kept after the judge (2.3% rejected)**, **349
diseases**, **~36,700 target-disease pairs**. Per-library bar (Elsevier 737, WikiPathways 179,
KEGG 88 kept). Lessons: PFOCR, the biggest library, yields zero (its terms are figure IDs, not
pathway names); metabolic and module libraries name no diseases; the 2.3% reject rate is
Reactome-like because these are named-disease labels, confirming the source-type rule.

**Say:** "Across the twelve libraries we keep 1,118 disease-pathway links over 349 diseases,
about 36,700 target-disease pairs. Two lessons. The biggest library, PFOCR with 22,000 terms,
gives nothing, because its 'terms' are figure IDs, not pathway names; label matching simply does
not apply. And the judge reject rate is only 2 percent here, Reactome-like, because these are
proper disease-named labels, exactly as the GO rule predicted. The method behaves predictably
across providers."

---

## IMPACT

### Slide 11 - Why integrate this

**On the slide:** Four points.
1. **Scale:** thousands of new disease-pathway links and tens of thousands of target-disease
   pairs across Reactome, GO and 12 libraries.
2. **No new data:** everything comes from resources that are already public or already in Open
   Targets. This recovers signal, it does not add a source.
3. **Universal and future-proof:** any new pathway or gene-set resource plugs in with no method
   change.
4. **Demonstrated need:** disease-pathway coverage was a limiting factor in two Open Targets
   experimental projects, Neuroflux and Neuroid.

**Say:** "Why does this matter for Open Targets. It is a large amount of new evidence from data
we already have, so it is recovering signal, not buying a new source. It is universal, so every
future pathway resource benefits with no new code. And the need is real: disease-pathway
coverage was a bottleneck in two of our experimental projects, Neuroflux and Neuroid. This is
not a hypothetical gap."

### Slide 12 - Conclusion and next steps

**On the slide:** One-line restatement: "Disease pathways are undercurated; the misses are
recoverable automatically, at scale, from existing data." Next steps: external validation
against disease-gene resources (DisGeNET, OMIM); per-release automation; feed candidates to
curators. A closing thank-you / contact.

**Say:** "To close: disease pathways are undercurated, the misses are recoverable, and the same
method works on any library from data we already hold. Next, validate the candidates against
independent disease-gene resources, run it every release, and put the candidates in front of
curators. The precision-first design and the judge mean the output is review-ready, not a noisy
list. Thank you."

---

## APPENDIX (backup slides, use only if asked)

### A1 - The judge, and why to trust it

**On the slide:** The judge is an annotating layer over the low-confidence tier only; template
matches are never sent. Safety metric: measured against curated evidence, its false-reject rate
on true positives is effectively zero. Reject examples across sources (protein names like CFTR
and DSCAM; word senses like long-term depression and sterile inflammation; SARS-CoV-2 vs SARS).

**Say (if asked "can the judge be trusted"):** "It only sees the uncertain matches, never the
structurally certain ones. And we measured it: of the curated true positives it did see, it
wrongly rejected essentially none. The one apparent miss was the EFO ontology error, where the
judge was right and the evidence was wrong."

### A2 - Judge model comparison (Haiku / Sonnet / Opus)

**On the slide:** Reactome reject counts 6 / 11 / 8 (91% three-way agreement); GO 37 / 24 / 21
(78%). Pricing per 1M tokens: Haiku 1/5, Sonnet 3/15, Opus 5/25. Disagreements cluster on the
ambiguous tail (SARS-CoV-2, hypoxia, cardiac vs skeletal muscle). Default is Sonnet.

**Say (if asked about model choice/cost):** "Three models agree on the large majority; they
differ only on genuinely ambiguous cases. No model is uniformly strictest. We default to Sonnet
as the middle option; the tier is small and cached, so cost is low either way."

### A3 - Non-recovery breakdown (Reactome)

**On the slide:** Of 531 not-recovered curated pairs: ~450 name no disease in the label
(unreachable), the rest split between correctly-refused acronym collisions and cases where the
matcher named a more specific disease. One example per reason.

**Say (if asked "why only 19%"):** "Strip out the pairs no label method could reach and the
cases where we were actually more specific, and the true 'should have found but did not' set is
small."

---

## Prioritisation notes (for the builder)

- The spine is undercuration -> proof -> scale. If time is short, the cuttable slides are 7
  (bonus), 8 (GO can be folded into a sentence on slide 9), and everything in the appendix.
- The two must-land points: slide 6 (complementary, not nested) and slide 11 (real need,
  existing data). Do not cut those.
- Keep target-disease counts as ranges or "deduplicated" figures; never a single inflated number.
- Neuroflux and Neuroid: state only that coverage was a limiting factor, as given; no invented
  specifics.
