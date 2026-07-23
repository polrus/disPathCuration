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
`data/<release>/`.

## Approach status

| Step | State |
| --- | --- |
| 1. Parse diseases into scored chunks | done |
| 2. Load pathway and process labels | reactome downloaded |
| 3. Match chunks against labels | next |
| 4. Compare against evidence, per gap type | not started |
| 5. Package as a pipeline | not started |

Steps 4 measures the two gap types separately: the mapping gap (Reactome annotated a disease
string that OT did not map to EFO) and the annotation gap (Reactome never annotated the
pathway, though its label names a disease).

## Development

```
pip install -e '.[dev]'
pytest
```

## Licence

MIT. See [LICENSE](LICENSE).
