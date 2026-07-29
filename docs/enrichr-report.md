# Enrichr disease-pathway extraction: per-library report

Disease names found in the term labels of Enrichr pathway libraries, using the disease chunk index and the matcher (templates off), then the LLM judge (Sonnet). Reactome and GO are excluded (covered via Open Targets); mouse variants are excluded (mouse gene symbols do not map to human targets). Counts below are judge-kept unless stated; the judge rejected 26 of 1,144 (2.3%).

## Summary

| Library | Terms | Matches | Kept | Rejected | Diseases | Target-disease |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| KEGG_2026 | 352 | 89 | 88 | 1 | 83 | 10874 |
| WikiPathways_2024_Human | 829 | 188 | 179 | 9 | 117 | 8648 |
| PFOCR_Pathways_2023 | 21845 | 0 | 0 | 0 | 0 | 0 |
| Elsevier_Pathway_Collection | 1721 | 746 | 737 | 9 | 243 | 19208 |
| BioPlanet_2019 | 1510 | 97 | 91 | 6 | 60 | 4249 |
| BioCarta_2016 | 237 | 13 | 13 | 0 | 11 | 258 |
| NCI-Nature_2016 | 209 | 4 | 3 | 1 | 3 | 101 |
| Panther_2016 | 112 | 5 | 5 | 0 | 4 | 374 |
| HumanCyc_2016 | 152 | 0 | 0 | 0 | 0 | 0 |
| MSigDB_Hallmark_2020 | 50 | 2 | 2 | 0 | 2 | 400 |
| MSigDB_Computational | 858 | 0 | 0 | 0 | 0 | 0 |
| MSigDB_Oncogenic_Signatures | 189 | 0 | 0 | 0 | 0 | 0 |
| **Total** | | **1144** | **1118** | | | |

## Per library (judge-kept)

### Elsevier_Pathway_Collection

1721 terms, **737 kept** (9 rejected) over 243 diseases, 19208 target-disease pairs.

| Pathway | Disease | Matched via | Method |
| --- | --- | --- | --- |
| Oxidative Stress in Amyotrophic Lateral Sclerosi | amyotrophic lateral sclerosis | amyotrophic lateral sclerosis | whole_form |
| Acute Myeloid Leukemia | acute myeloid leukemia | acute myeloid leukemia | whole_form |
| Acute Phase in Atopic Dermatitis | atopic eczema | atopic dermatitis | whole_form |
| Adipokines and Cytokines in Insulin Resistance i | Insulin resistance | Insulin resistance | whole_form |
| Adiponectin in Insulin Resistance Prevention | Insulin resistance | Insulin resistance | whole_form |
| Adiponectin Synthesis Declines in Insulin Resist | Insulin resistance | Insulin resistance | whole_form |
| Adipose Tissue Inflammation Provokes Insulin Res | Insulin resistance | Insulin resistance | whole_form |
| Advanced Glycation End Products in Diabetes or A | erectile dysfunction | erectile dysfunction | whole_form |

### WikiPathways_2024_Human

829 terms, **179 kept** (9 rejected) over 117 diseases, 8648 target-disease pairs.

| Pathway | Disease | Matched via | Method |
| --- | --- | --- | --- |
| Smith Magenis And Potocki Lupski Syndrome Copy N | Potocki-Lupski syndrome | Potocki-Lupski syndrome | whole_form |
| Type I Interferon Induction And Signaling SARS C | COVID-19 | CoV-2 infection | whole_form |
| FGF23 Signaling In Hypophosphatemic Rickets Rela | hypophosphatemic rickets | hypophosphatemic rickets | whole_form |
| Genes Associated With The Development Of Rheumat | rheumatoid arthritis | rheumatoid arthritis | whole_form |
| Multiple Epiphyseal Dysplasia And Pseudoachondro | multiple epiphyseal dysplasia | multiple epiphyseal dysplasia | whole_form |
| Amino Acid Metabolism In Triple Negative Breast  | triple-negative breast carcinoma | triple-negative breast cancer | whole_form |
| Cells And Molecules Involved In Acute Inflammato | inflammation | inflammatory response | whole_form |
| Synaptic Signaling Associated With Autism Spectr | autism spectrum disorder | autism spectrum disorder | whole_form |

### BioPlanet_2019

1510 terms, **91 kept** (6 rejected) over 60 diseases, 4249 target-disease pairs.

| Pathway | Disease | Matched via | Method |
| --- | --- | --- | --- |
| APOBEC3G-mediated resistance to HIV-1 infection | HIV-1 infection | HIV-1 infection | whole_form |
| Acute myeloid leukemia | acute myeloid leukemia | acute myeloid leukemia | whole_form |
| Acute myocardial infarction | acute myocardial infarction | acute myocardial infarction | whole_form |
| Acute myocardial infarction | myocardial infarction | myocardial infarction | whole_form |
| Amyotrophic lateral sclerosis (ALS) | amyotrophic lateral sclerosis | amyotrophic lateral sclerosis | whole_form |
| Arrhythmogenic right ventricular cardiomyopathy  | Arrhythmogenic right ventricular dys | Arrhythmogenic right ventricular | whole_form |
| Arrhythmogenic right ventricular cardiomyopathy  | arrhythmogenic right ventricular car | arrhythmogenic right ventricular | whole_form |
| Arrhythmogenic right ventricular cardiomyopathy  | Right ventricular cardiomyopathy | Right ventricular cardiomyopathy | whole_form |

### KEGG_2026

352 terms, **88 kept** (1 rejected) over 83 diseases, 10874 target-disease pairs.

| Pathway | Disease | Matched via | Method |
| --- | --- | --- | --- |
| ARRHYTHMOGENIC RIGHT VENTRICULAR CARDIOMYOPATHY | Arrhythmogenic right ventricular dys | Arrhythmogenic right ventricular | whole_form |
| ARRHYTHMOGENIC RIGHT VENTRICULAR CARDIOMYOPATHY | arrhythmogenic right ventricular car | arrhythmogenic right ventricular | whole_form |
| ARRHYTHMOGENIC RIGHT VENTRICULAR CARDIOMYOPATHY | Right ventricular cardiomyopathy | Right ventricular cardiomyopathy | whole_form |
| KAPOSI SARCOMA-ASSOCIATED HERPESVIRUS INFECTION | Kaposi's sarcoma | Kaposi's sarcoma | whole_form |
| KAPOSI SARCOMA-ASSOCIATED HERPESVIRUS INFECTION | Herpesviridae infectious disease | herpesvirus infection | whole_form |
| HUMAN IMMUNODEFICIENCY VIRUS 1 INFECTION | HIV-1 infection | Human Immunodeficiency Virus 1 | whole_form |
| HUMAN T-CELL LEUKEMIA VIRUS 1 INFECTION | T-cell leukemia | T-cell leukemia | whole_form |
| PATHOGENIC ESCHERICHIA COLI INFECTION | escherichia coli infection | escherichia coli infection | whole_form |

### BioCarta_2016

237 terms, **13 kept** (0 rejected) over 11 diseases, 258 target-disease pairs.

| Pathway | Disease | Matched via | Method |
| --- | --- | --- | --- |
| Reversal of Insulin Resistance by Leptin Homo sa | Insulin resistance | Insulin resistance | whole_form |
| Skeletal muscle hypertrophy is regulated via AKT | Skeletal muscle hypertrophy | Skeletal muscle hypertrophy | whole_form |
| Multi-Drug Resistance Factors Homo sapiens h mrp | Refractory drug response | Drug resistance | whole_form |
| HIV-1 Nef: negative effector of Fas and TNF Homo | HIV infectious disease | hiv | alias |
| Hypoxia-Inducible Factor in the Cardiovascular S | hypoxia | hypoxia | alias |
| Calcium Signaling by HBx of Hepatitis B virus Ho | hepatitis B virus infection | Hepatitis B | whole_form |
| Role of EGF Receptor Transactivation by GPCRs in | cardiac hypertrophy | cardiac hypertrophy | whole_form |
| Pertussis toxin-insensitive CCR5 Signaling in Ma | pertussis | pertussis | whole_form |

### Panther_2016

112 terms, **5 kept** (0 rejected) over 4 diseases, 374 target-disease pairs.

| Pathway | Disease | Matched via | Method |
| --- | --- | --- | --- |
| Parkinson disease Homo sapiens P00049 | Parkinson disease | Parkinson disease | whole_form |
| Hypoxia response via HIF activation Homo sapiens | hypoxia | hypoxia | alias |
| Huntington disease Homo sapiens P00029 | Huntington disease | Huntington disease | whole_form |
| Alzheimer disease-amyloid secretase pathway Homo | Alzheimer disease | Alzheimer disease | whole_form |
| Alzheimer disease-presenilin pathway Homo sapien | Alzheimer disease | Alzheimer disease | whole_form |

### NCI-Nature_2016

209 terms, **3 kept** (1 rejected) over 3 diseases, 101 target-disease pairs.

| Pathway | Disease | Matched via | Method |
| --- | --- | --- | --- |
| HIV-1 Nef: Negative effector of Fas and TNF-alph | HIV infectious disease | hiv | alias |
| Cellular roles of Anthrax toxin Homo sapiens bb8 | anthrax infection | anthrax | alias |
| Fanconi anemia pathway Homo sapiens 6befb873-619 | Fanconi anemia | Fanconi anemia | whole_form |

### MSigDB_Hallmark_2020

50 terms, **2 kept** (0 rejected) over 2 diseases, 400 target-disease pairs.

| Pathway | Disease | Matched via | Method |
| --- | --- | --- | --- |
| Inflammatory Response | inflammation | inflammatory response | whole_form |
| Hypoxia | hypoxia | hypoxia | alias |

### PFOCR_Pathways_2023

21845 terms, **0 matches**: terms are PMC figure IDs (e.g. `PMC102186 F9`), not pathway names, so there is no label to match; not applicable to label matching.

### HumanCyc_2016

152 terms, **0 matches**: metabolic pathways only; no term names a disease.

### MSigDB_Computational

858 terms, **0 matches**: terms are computational gene-module IDs (e.g. `MORF ATRX`), not disease-named pathways.

### MSigDB_Oncogenic_Signatures

189 terms, **0 matches**: terms are perturbation signatures (e.g. `AKT_UP.V1_UP`), not disease-named pathways.

## Judge rejections (contextual false positives removed)

| Library | Pathway | Matched | Disease | Reason |
| --- | --- | --- | --- | --- |
| KEGG_2026 | LONG-TERM DEPRESSION | depression | depressive disorder | long-term depression here is a synaptic plasticity term, not |
| WikiPathways_2024_Human | SARS CoV 2 And ACE2 Receptor Molec | sars | severe acute respira | sars is part of the virus name SARS-CoV-2; pathway concerns  |
| WikiPathways_2024_Human | Linoleic Acid Metabolism Affected  | sars | severe acute respira | sars is part of the virus name SARS-CoV-2, not the disease s |
| WikiPathways_2024_Human | Activation Of NLRP3 Inflammasome B | sars | severe acute respira | sars is part of the virus name SARS-CoV-2, not the disease s |
| WikiPathways_2024_Human | Autophagy In Pancreatic Ductal Ade | ductal adenocarcinom | invasive ductal brea | ductal adenocarcinoma here is pancreatic, not breast; differ |
| WikiPathways_2024_Human | Mitochondrial Immune Response To S | sars | severe acute respira | sars is part of the virus name SARS-CoV-2, not the disease s |
| WikiPathways_2024_Human | SARS CoV 2 Altering Angiogenesis V | sars | severe acute respira | sars is part of the virus name SARS-CoV-2, not the disease s |
| WikiPathways_2024_Human | Retinoblastoma Gene In Cancer WP24 | retinoblastoma | retinoblastoma | 'retinoblastoma' modifies 'Gene', naming the RB1 gene, not t |
| WikiPathways_2024_Human | T Cell Activation SARS CoV 2 WP509 | sars | severe acute respira | 'SARS' here names the virus SARS-CoV-2, and the pathway conc |
| WikiPathways_2024_Human | Rubinstein Taybi Syndrome 1 WP5367 | taybi syndrome | otopalatodigital syn | 'Taybi syndrome' is part of 'Rubinstein-Taybi syndrome', a d |
| Elsevier_Pathway_Collection | Activin, Inhibin and Follistatin A | pituitary gland | hypophysitis | pituitary gland is the organ, not hypophysitis (inflammation |
| Elsevier_Pathway_Collection | Lipoxin A4/FPR2-Related Neutrophil | depression | depressive disorder | neutrophil depression means suppression of neutrophil activi |
| Elsevier_Pathway_Collection | Proteins Involved in Stem Cell Exh | exhaustion | exhaustion | stem cell exhaustion is a depletion process, not the disease |
| Elsevier_Pathway_Collection | Toll-like Receptor Independent Ste | sterile | infertility disorder | sterile inflammation means aseptic (non-infectious) inflamma |
| Elsevier_Pathway_Collection | Toll-like Receptors in Sterile Inf | sterile | infertility disorder | sterile inflammation means aseptic (non-infectious) inflamma |
| Elsevier_Pathway_Collection | Glutamate Overdose and Aura Effect | overdose | overdose | glutamate overdose denotes excitotoxic excess neurotransmitt |
| Elsevier_Pathway_Collection | Glutamate Overdose and Aura Effect | overdose | overdose | glutamate overdose denotes excitotoxic excess neurotransmitt |
| Elsevier_Pathway_Collection | Glutamate Overdose and Aura Effect | overdose | overdose | glutamate overdose denotes excitotoxic excess neurotransmitt |
| Elsevier_Pathway_Collection | Proteins Involved in Antiphospholi | antiphospholipid syn | autoimmune polyendoc | matched text is antiphospholipid syndrome, unrelated to auto |
| BioPlanet_2019 | Cystic fibrosis transmembrane cond | cystic fibrosis | cystic fibrosis | part of CFTR protein full name, not a disease reference |
| BioPlanet_2019 | Down syndrome cell adhesion molecu | down syndrome | Down syndrome | part of DSCAM protein full name, not a disease reference |
| BioPlanet_2019 | Gene expression regulation by hypo | hypoxia | hypoxia | part of hypoxia-inducible factor protein name, not a disease |
| BioPlanet_2019 | Long-term depression | depression | depressive disorder | depression here is synaptic long-term depression, not the mo |
| BioPlanet_2019 | Pertussis toxin-insensitive CCR5 s | pertussis | pertussis | pertussis toxin is a reagent name, not the disease |
| BioPlanet_2019 | Retinoblastoma protein regulation | retinoblastoma | retinoblastoma | retinoblastoma protein (RB1) is a gene/protein name here, no |
| NCI-Nature_2016 | Regulation of retinoblastoma prote | retinoblastoma | retinoblastoma | refers to retinoblastoma protein (RB1 gene product), not the |

