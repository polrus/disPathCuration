"""Release pinning and shared constants."""

from pathlib import Path

# Pinned deliberately. The `latest` symlink on the FTP tracks a run whose
# manifest currently reports result="failure", so it is not safe to build on.
RELEASE = "26.06"

FTP_BASE = f"https://ftp.ebi.ac.uk/pub/databases/opentargets/platform/{RELEASE}/output"

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data" / RELEASE

# Datasets pulled from the platform. The facet search index is not published to
# the FTP in any release from 24.09 onwards, so pathway and process labels are
# taken from the `reactome` and `go` datasets it is derived from.
DATASETS = {
    "disease": "disease/disease.parquet",
    "go": "go/go.parquet",
    # Partitioned datasets: the file name carries a per-release UUID, so these
    # are resolved by listing the directory rather than hard-coded.
    "reactome": None,
    "evidence_reactome": None,
}

# EFO "measurement". 53% of the disease dataset sits under this therapeutic
# area: GWAS trait terms such as "Increased circulating ACTH level". They are
# not diseases and must be excluded before any indexing.
MEASUREMENT_AREA = "EFO_0001444"

# Ontology head nouns and qualifiers. These carry no discriminative signal on
# their own, but are kept inside longer chunks where they do disambiguate
# (for example "maple syrup urine disease").
GENERIC_HEADS = frozenset(
    """
    disease diseases disorder disorders syndrome syndromes deficiency
    deficiencies defect defects abnormality abnormalities condition
    type subtype form variant variants susceptibility
    familial congenital hereditary inherited acquired idiopathic
    autosomal recessive dominant linked sporadic juvenile infantile adult
    early late onset severe mild moderate progressive chronic acute
    """.split()
)

# Function words. Dropped from chunk boundaries but not from chunk interiors.
STOPWORDS = frozenset("of in with and or to due the a an by for at on from".split())
