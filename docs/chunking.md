# Disease chunks: examples, considerations, limitations

This note documents how diseases are turned into searchable chunks, what the current index
looks like on real terms, and what a strict, high-precision rule keeps and misses. All numbers
are from release 26.06.

## What a chunk is

A surface form is a disease name or one of its exact synonyms, normalised (casefolded, Greek
letters expanded, diacritics stripped, possessives and triggered Roman numerals resolved). A
chunk is a contiguous token span of a surface form. Each chunk carries three numbers:

- `specificity`: summed inverse document frequency of its tokens over the disease corpus.
  High for `diabetes mellitus`, near zero for `type 2`.
- `coverage`: the share of its surface form's total IDF mass the chunk accounts for. A chunk
  equal to the whole surface form scores 1.00; a fragment scores lower.
- `shared_by`: how many distinct diseases carry the chunk. A direct measure of ambiguity.

## Worked examples

### Parkinson disease (6 chunks)

```
paralysis agitans     spec 16.2  cov 1.00  shared_by 1     [exact_synonym]
agitans               spec 10.0  cov 0.62  shared_by 1     [exact_synonym]
parkinson disease     spec  9.1  cov 1.00  shared_by 18    [name]
pd                    spec  8.9  cov 1.00  shared_by 3     [abbreviation]
parkinson             spec  7.1  cov 0.77  shared_by 19    [name]
paralysis             spec  6.2  cov 0.38  shared_by 46    [exact_synonym]
```

`parkinson disease` is shared by 18 diseases because every Parkinson subtype (`Parkinson
disease 14`, `Parkinson disease 15`, ...) contains it. That is correct behaviour: a hit still
implies the Parkinson family. `pd` is a two-letter abbreviation and a liability (see below).

### type 2 diabetes mellitus (178 chunks)

This is the firehose the current chunker produces. A handful of chunks are useful:

```
type 2 diabetes mellitus          spec 16.8  cov 1.00  shared_by 2     [name]
non insulin dependent diabetes mellitus  spec 29.1  cov 1.00  shared_by 1  [exact_synonym]
niddm                             spec 10.0  cov 1.00  shared_by 1     [exact_synonym]
```

The rest are fragments that match far too broadly and must never fire on their own:

```
type 2 diabetes       spec 10.5  cov 0.63  shared_by 4
diabetes mellitus     spec 11.7  cov 0.30  shared_by 41
diabetes              spec  5.4  cov 0.19  shared_by 97
type 2                spec  5.1  cov 0.30  shared_by 493
non                   spec  4.1  cov 0.14  shared_by 359
2                     spec  3.3  cov 0.20  shared_by 813
```

`type 2` is shared by 493 diseases and `2` by 813. Any rule that accepts them accepts almost
everything.

## The case for a strict rule

Requiring `coverage = 1.00`, so a chunk must be a whole disease name or a whole exact synonym
rather than a fragment, removes the entire firehose without losing reach:

| Rule | Distinct chunks | Diseases still matchable |
| --- | ---: | ---: |
| All chunks (current) | 252,699 | 22,029 (100%) |
| coverage = 1.00 | 77,720 | 22,029 (100%) |
| coverage = 1.00, no abbreviations | 73,289 | 22,026 (100%) |
| also require >= 2 tokens | 71,064 | 21,540 (97.8%) |
| also require shared_by = 1 | 61,382 | 19,513 (88.6%) |

Coverage alone cuts noise by 70% and costs nothing in reach: the sub-fragments never let a
disease match anything the whole form could not. This is the recommended base rule. It reduces
matching to whole-surface-form dictionary lookup, which is exactly the precise behaviour we
want.

## Considerations that still need a decision

1. **Generic biological-process terms.** The disease dataset contains 735 terms that sit under
   the GO biological_process branch: `cell cycle`, `metabolic process`, `transport`,
   `digestion`. These produce false positives such as `Surfactant metabolism -> metabolic
   process` and `Cell Cycle -> cell cycle`. Recommendation: exclude the GO_0008150 branch.

2. **Single-word names split into two populations.** Requiring two or more tokens would drop
   489 diseases whose only handle is one word. Some are precise and valuable
   (`hyperargininemia`, `mucoviscidosis`, `spherocytosis`); others are generic
   (`fibrosis`, shared by 54; `deafness`, shared by 253). A blanket rule is wrong. A single
   token should be kept only if specific enough (high specificity and low `shared_by`).

3. **Abbreviations.** Matched case sensitively, but short ones are dangerous: `PD`, `CF`, `AS`
   collide with gene names and ordinary tokens. Dropping abbreviations entirely costs only 3
   diseases, because almost all are redundant with a full name. Recommendation for strict mode:
   drop them, or keep only length >= 4.

4. **Synonym scope.** Exact synonyms only, as agreed. Narrow, broad and related synonyms are
   held back. This is already the strict choice.

## Limitations: what a strict rule misses

A whole-form rule fires only when a pathway label contains a complete disease name or exact
synonym as a contiguous span. It therefore misses:

- Labels that mention a disease by a partial or reordered phrase not in the synonym list.
- Labels that imply a disease without naming it (`Defective MUTYH substrate binding`, which
  curators know maps to colorectal cancer).
- Morphological variants outside normalisation (plurals, adjectival forms).

## The finding that reframes the ground truth

The stated expectation was that the method should recreate all manually curated Reactome
evidence and add more. Tested against the data, a label-matching method cannot do the first
part, and this is a property of the evidence, not a weakness of the method.

Running the strict whole-form matcher over all 2,870 Reactome labels and comparing to the 653
pathway-disease pairs in `evidence_reactome`:

| Measure | Value |
| --- | ---: |
| Evidence pairs recovered, exact EFO id | 80 of 653 (12.3%) |
| Evidence pairs recovered, allowing ontology parent/child | 110 of 653 (16.8%) |
| Evidence pathways whose label carries no matchable disease name | 374 of 556 (67%) |
| New pairs found (label names a disease, absent from evidence) | ~900 |

Two thirds of curated evidence sits on pathways whose label does not name the disease at all.
Reactome curators assign diseases from pathway biology and gene-disease knowledge, for example
`Signaling by cytosolic PDGFRA and PDGFRB fusion -> cancer` or `TICAM1 deficiency - HSE ->
inborn error of immunity`. No string matcher can recover these from the label.

The consequence is that label matching and manual curation are **complementary, not nested**.
They find different populations:

- Manual curation finds biology-driven links, disease name usually absent from the label.
- Label matching finds label-driven links, disease name present, roughly 900 of which are
  absent from current evidence.

The undercuration hypothesis remains testable and interesting, but its correct form is
narrower: among pathways whose label explicitly names a disease, how many lack the
corresponding curated evidence. That is the annotation gap, and the strict matcher already
surfaces a candidate set of about 900 for it. The 500-odd curated links the matcher does not
recover are not misses to be fixed; they are links no label-based method could produce, and
they should be excluded from the recall denominator.
