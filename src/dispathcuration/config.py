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
    # are resolved by listing the directory rather than hard-coded. A value of
    # None means "one part"; a list means "many parts, concatenate".
    "reactome": None,
    "evidence_reactome": None,
    "target": [],
}

# EFO "measurement". 53% of the disease dataset sits under this therapeutic
# area: GWAS trait terms such as "Increased circulating ACTH level". They are
# not diseases and must be excluded before any indexing.
MEASUREMENT_AREA = "EFO_0001444"

# GO biological_process. 735 disease rows sit under this branch: "cell cycle",
# "metabolic process", "transport", "digestion". They match pathway labels
# freely ("Surfactant metabolism" -> "metabolic process") and are excluded as
# match targets.
PROCESS_AREA = "GO_0008150"

# Acceptance thresholds for the whole-form matcher, both tunable.
# A matched form must clear MIN_SPECIFICITY. A single-token form must clear the
# stricter single-token bar as well, which drops generic one-word names such as
# "fibrosis" (specificity 6.0) while keeping "hyperargininemia" (9.3).
MIN_SPECIFICITY = 8.0
SINGLE_TOKEN_MIN_SPECIFICITY = 9.0

# A distinctive-token alias is a single-token disease name matched free-floating
# in a label, without a template to license it. Two lengths of token behave very
# differently and are governed separately.
#
# Long tokens (>= ALIAS_AUTO_LENGTH) are spelled-out disease words such as
# "influenza", "citrullinemia", "leishmaniasis". They are auto-accepted, subject
# to the sharing and gene-symbol filters below.
#
# Short tokens (3 to ALIAS_AUTO_LENGTH-1) are acronyms. Auto-accepting them fails:
# "ips", "abc", "can", "spms", "npc" are biology tokens (stem cells, transporters,
# the English word "can", pro-resolving mediators, nuclear pore complex) that
# collide with a rare disease's acronym. Short acronyms are therefore admitted
# only from an explicit, reviewed allow-list mapping each token to one disease.
# The mapping is given directly rather than resolved from the index because the
# strongest case, "hiv", never appears as a whole disease name: it is only ever a
# fragment of "HIV infectious disease", so the index cannot supply it. Disease
# acronyms that appear inside a "causes" template (PXE, OCA6, SEMD) are not listed
# here; the template extractor already licenses them.
ALIAS_MIN_LENGTH = 3
ALIAS_AUTO_LENGTH = 6
ALIAS_ALLOWLIST = {
    "hiv": "MONDO_0005109",   # HIV infectious disease
    "sars": "MONDO_0005091",  # severe acute respiratory syndrome
    "hse": "MONDO_0012521",   # herpes simplex encephalitis
    "msud": "MONDO_0009563",  # maple syrup urine disease
}

# A distinctive-token alias must be shared across at most this many diseases in
# the corpus. Sharing, not raw specificity, is what separates a distinctive
# token from a generic one: "hiv" and "sars" are shared by a handful of
# diseases, while "cancer" (521) and "infection" (247) are generic and would
# match pathway labels for the wrong reason. Raw specificity cannot draw this
# line, since "hiv" (7.6) scores below the generic "toxicity" cutoff.
MAX_ALIAS_SHARING = 15

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
