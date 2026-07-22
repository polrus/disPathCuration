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

| Input | Source |
| --- | --- |
| Disease names and synonyms | Open Targets disease ontology (EFO/MONDO) |
| Pathway and process labels | Open Targets Platform facets file |
| Comparison baseline | Open Targets Reactome target-disease evidence |

## Status

Early stage. The repository contains the project definition only. Extraction code, choice of
matching strategy, and evaluation are not yet written.

## Licence

MIT. See [LICENSE](LICENSE).
