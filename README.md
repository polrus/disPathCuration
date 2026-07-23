# disPathCuration

Finding disease names in pathway labels.

## Motivation

Open Targets derives target-disease evidence from Reactome. That evidence depends on manual
curation of which pathways belong to which disease.

This project tests one hypothesis: disease pathways are undercurated. Many pathways and
biological processes carry a disease name in their label, yet produce no corresponding
target-disease evidence. If the hypothesis holds, the missing links can be recovered
automatically from data that Open Targets already distributes.

The hypothesis is untested. Step 4 below is what decides it.

## Approach

1. **Diseases.** Take disease names and synonyms from the Open Targets disease ontology
   (EFO/MONDO).
2. **Pathways and processes.** Take pathway and process labels from the Open Targets
   Platform facets file.
3. **Match.** Search pathway labels for chunks of disease names, yielding candidate
   disease-pathway links. The matching strategy is not yet chosen. Exact substring,
   normalised n-grams, and fuzzy string methods each need evaluating.
4. **Compare.** Score the extracted set against current Open Targets Reactome
   target-disease evidence, separating links that are already curated from links that are
   absent.
5. **Pipeline.** Package the extraction so candidates can be regenerated when the ontology
   or the facets file changes.

## Data sources

Release 26.06 is pinned. The `latest` symlink currently points at a run whose manifest
reports a build failure, so it is not used.

| Input | Source |
| --- | --- |
| Disease names and synonyms | `disease` dataset (EFO/MONDO) |
| Pathway and process labels | `reactome` dataset |
| Comparison baseline | `evidence_reactome` dataset |

The facet search index is not published to the FTP in any release from 24.09 onwards, so
pathway labels are taken from the `reactome` dataset the index is built from.

## Disease chunk index

The first stage parses diseases and turns them into searchable chunks. Whole disease names
rarely appear verbatim in a pathway label (EFO names average 5.4 tokens), so matching has to
happen on sub-spans, and most sub-spans are worthless: `type`, `2` and `disease` occur across
thousands of diseases.

Design decisions, each grounded in the data:

- **Measurement terms are excluded.** 25,049 of the 47,080 disease rows sit under the EFO
  measurement therapeutic area (GWAS traits such as "Increased circulating ACTH level").
  They are not diseases, and their vocabulary would dominate any index. This leaves 22,031
  diseases.
- **Exact synonyms only.** The primary name plus exact synonyms. Narrow, broad and related
  synonyms are held back as the main source of false matches.
- **Abbreviations are matched case sensitively.** Acronyms such as `PDS` are routed to a
  separate whole-token dictionary so they do not collide with ordinary words.
- **Chunks are scored on two axes.** `specificity` is the summed inverse document frequency
  of a chunk's tokens; `coverage` is the share of its surface form's IDF mass the chunk
  carries. Both are needed: `hyperargininemia` (a whole disease name) and `cause` (a
  fragment of "death by undetermined cause") share the same specificity, and only coverage
  separates them.

Build it with:

```
python scripts/build_disease_index.py
```

This writes `disease_surface_forms.parquet` and `disease_chunks.parquet` under
`data/<release>/`. Full detail is in [docs/chunking.md](docs/chunking.md).

## Matching

Three complementary extractors turn chunks into pathway-disease matches, in order of
precedence:

- **template**: the disease slot of a "causes" label (`Defective ABCC6 causes PXE`), which
  licenses acronyms the structure proves are diseases.
- **whole_form**: a complete disease name or exact synonym found as a token span. Fragments
  are never matched.
- **alias**: a distinctive single disease token (`HIV`), hard filtered against gene symbols,
  generic terms and short acronyms. The lowest-confidence method, flagged for review.

Global abbreviation matching is deliberately excluded: it recovered 10 curated links while
adding 61 acronym collisions. Full detail, filters and examples are in
[docs/matching.md](docs/matching.md).

```
python scripts/run_matcher.py
```

## Recovery against curated evidence

The Reactome evidence is treated as a recall floor, not a ceiling: the project premise is that
it is incomplete. Of its 653 curated pathway-disease pairs, the matcher recovers 122 (18.7%),
of which 28 resolve a more specific disease than the curator recorded. The low figure is a
property of the evidence, not the method: 450 of the not-recovered pairs sit on pathways whose
label does not name the disease at all, so no label-based method can reach them.

The matcher also produces two actionable outputs: 263 new candidate links absent from the
evidence, and the specificity improvements where the label names a subtype the curation
recorded only as a parent.

## Approach status

| Step | State |
| --- | --- |
| 1. Parse diseases into scored chunks | done |
| 2. Load pathway and process labels | done |
| 3. Match chunks against labels | done |
| 4. Compare against evidence, per reason | done |
| 5. Package as a pipeline | partial |

## Development

```
pip install -e '.[dev]'
pytest
```

## Licence

MIT. See [LICENSE](LICENSE).
