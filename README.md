# disPathCuration

Finding disease names in pathway labels.

## Motivation

Open Targets derives target–disease evidence from Reactome, but that evidence depends on
manual curation of which pathways belong to which disease. The working hypothesis of this
project is that **disease pathways are undercurated**: many pathways and biological
processes carry a disease name directly in their label, yet never surface as target–disease
evidence.

If that holds, the mapping can largely be recovered automatically — and the extra
target–disease evidence that follows comes for free from data Open Targets already ships.

## Idea

1. **Diseases** — take disease names and synonyms from the Open Targets disease ontology
   (EFO/MONDO).
2. **Pathways and processes** — take every pathway/process label available in the Open
   Targets infrastructure, via the Platform *facets* file.
3. **Match** — search pathway labels for chunks of disease names, producing candidate
   disease ↔ pathway links. The matching strategy itself is an open question: exact
   substring, normalised n-grams, and fuzzier approaches all need comparing.
4. **Compare** — evaluate the extracted set against the current Open Targets Reactome
   target–disease evidence, to separate what is already curated from what is missing.
5. **Pipeline** — package the extraction so new candidate evidence can be regenerated as
   the ontology and the facets file change.

## Data sources

| Input | Source |
| --- | --- |
| Disease names and synonyms | Open Targets disease ontology (EFO/MONDO) |
| Pathway / process labels | Open Targets Platform facets file |
| Baseline for comparison | Open Targets Reactome target–disease evidence |

## Status

Early stage — the repository currently holds the project definition. Extraction code,
matching strategy, and evaluation are still to be written.

## Licence

MIT — see [LICENSE](LICENSE).
