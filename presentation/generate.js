// Open Targets house-style deck for the disPathCuration talk.
// Content follows docs/presentation-plan.md (release 26.06).
// Copy is deliberately terse: bullet points, not prose. Minimum text size 12pt.
// Build: node generate.js -> disease-pathways.pptx
const pptxgen = require('pptxgenjs');
const T = require('./theme.js');
const {
  C, TITLE_FONT, BODY_FONT, LABEL_FONT,
  titleSlide, sectionDivider, bigStat, table, schemaFlow,
  contentTitle, addLogo, pageNum, footer, node, coralBox, arrow,
} = T;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'Polina Rusina';
pres.title = 'Automatic curation of disease pathways';

// ---------------------------------------------------------------- helpers
function bullets(s, items, o = {}) {
  s.addText(
    items.map((t) => (typeof t === 'string' ? { text: t, options: { breakLine: true } } : t)),
    {
      x: o.x ?? 0.6, y: o.y ?? 2.0, w: o.w ?? 12.1, h: o.h ?? 4.2,
      fontFace: BODY_FONT, fontSize: o.fontSize ?? 16, color: o.color ?? C.ink,
      valign: 'top', lineSpacing: (o.fontSize ?? 16) * 1.6,
      bullet: { code: '2022', indent: 16 },
    },
  );
}

// One short grey line under a content title (numbers, scope, source).
function subline(s, text, o = {}) {
  s.addText(text, {
    x: 0.6, y: o.y ?? 1.8, w: o.w ?? 12.1, h: o.h ?? 0.55, fontFace: BODY_FONT,
    fontSize: o.fontSize ?? 13, color: C.grey, valign: 'top', lineSpacing: 19,
  });
}

// Emphasised take-away line across the foot. Keep to one line (about 145 chars).
function takeaway(s, text, y = 6.55) {
  s.addText(text, {
    x: 0.6, y, w: 10.8, h: 0.45, fontFace: LABEL_FONT, fontSize: 14, bold: true,
    color: C.blue, valign: 'middle', lineSpacing: 18,
  });
}

// Column cards holding a real bullet list, plus an optional example line at the
// foot of the card. Same geometry and palette as theme.columns.
function cardList(title, kick, cols, o = {}) {
  const s = pres.addSlide();
  s.background = { color: C.paper };
  contentTitle(s, title, { kicker: kick, fontSize: o.fontSize });
  const n = cols.length, gap = 0.5, mx = 0.6;
  const colW = (T.W - 2 * mx - (n - 1) * gap) / n;
  const cardY = o.cardY ?? 2.0, cardH = o.cardH ?? 4.3, padX = 0.32;
  cols.forEach((c, i) => {
    const x = mx + i * (colW + gap);
    s.addShape('roundRect', { x, y: cardY, w: colW, h: cardH, rectRadius: 0.06,
      fill: { color: 'F4F6F9' }, line: { color: 'E4E9F0', width: 1 } });
    let cy = cardY + 0.35;
    if (c.chip !== undefined) {
      s.addShape('ellipse', { x: x + padX, y: cy, w: 0.6, h: 0.6, fill: { color: C.blue }, line: { type: 'none' } });
      s.addText(String(c.chip), { x: x + padX, y: cy, w: 0.6, h: 0.6, margin: 0,
        fontFace: TITLE_FONT, fontSize: 20, bold: true, color: C.paper, align: 'center', valign: 'middle' });
      cy += 0.8;
    }
    s.addText(c.label, { x: x + padX, y: cy, w: colW - padX * 2, h: 0.4, fontFace: LABEL_FONT,
      fontSize: 17, color: C.navy, valign: 'top' });
    const exH = c.example ? 1.15 : 0;
    s.addText(c.items.map((t) => ({ text: t, options: { breakLine: true } })), {
      x: x + padX, y: cy + 0.5, w: colW - padX * 2, h: cardH - (cy - cardY) - 0.75 - exH,
      fontFace: BODY_FONT, fontSize: 13, color: C.ink, valign: 'top', lineSpacing: 20,
      bullet: { code: '2022', indent: 14 },
    });
    if (c.example) {
      const ey = cardY + cardH - exH - 0.1;
      s.addShape('line', { x: x + padX, y: ey, w: colW - padX * 2, h: 0,
        line: { color: 'D9DEE6', width: 1 } });
      s.addText(c.example, { x: x + padX, y: ey + 0.1, w: colW - padX * 2, h: exH - 0.15,
        fontFace: BODY_FONT, fontSize: 12, color: C.grey, valign: 'top', lineSpacing: 16 });
    }
  });
  addLogo(s, 'light');
  return s;
}

function content(title, kicker, opts = {}) {
  const s = pres.addSlide();
  s.background = { color: C.paper };
  contentTitle(s, title, { kicker, fontSize: opts.fontSize });
  return s;
}

let PAGE = 0;
function page(s) { pageNum(s, ++PAGE); }
function last() { return pres.slides[pres.slides.length - 1]; }

const REL = 'Open Targets Platform release 26.06.';

// ================================================================ 1. Title
titleSlide(pres, {
  title: 'Automatic curation of disease pathways',
  meta: ['disPathCuration', 'Open Targets', 'August 2026', 'Polina Rusina'],
});

// ================================================================ PART 1
sectionDivider(pres, { part: 'Part 1', title: 'The gap, and how we close it' });

// ---------------------------------------------------------------- 1. Problem
(() => {
  const s = content('Disease pathways are undercurated', 'The problem');
  node(s, { x: 0.6, y: 2.15, w: 5.4, h: 1.0,
    label: 'Reactome:  "Defective ABCC6 causes PXE"', fill: C.blue, fontSize: 14 });
  arrow(s, 6.15, 2.65, 7.05, 2.65);
  coralBox(s, { x: 7.2, y: 2.15, w: 5.1, h: 1.0,
    label: 'no target-disease evidence', fontSize: 14 });
  s.addText('pseudoxanthoma elasticum: named in the label, unlinked in the evidence', {
    x: 0.6, y: 3.2, w: 11.7, h: 0.35, fontFace: BODY_FONT, fontSize: 12, color: C.grey,
    align: 'center' });
  bullets(s, [
    'Gene in a disease-annotated pathway → target-disease evidence',
    'The pathway-disease link is decided by manual curation',
    'Many labels name a disease, yet yield no evidence',
    'Recoverable automatically, from data Open Targets already ships',
  ], { y: 3.9, h: 2.4, fontSize: 16 });
  addLogo(s, 'light'); page(s);
})();

// ---------------------------------------------------------------- 2. Pipeline
(() => {
  const s = schemaFlow(pres, {
    title: 'One pipeline, four stages, plus an optional judge',
    stages: [
      { label: 'Inputs', fill: C.navy,
        detail: ['disease (EFO)', 'target (genes)', 'reactome', 'evidence_reactome'],
        caption: 'datasets already shipped' },
      { label: 'Chunk index',
        detail: ['normalise', 'split to sub-spans', 'score each chunk'],
        caption: 'diseases become searchable text' },
      { label: 'Matcher',
        detail: ['template', 'whole_form', 'alias'],
        caption: 'disease names found in labels' },
      { label: 'LLM judge', fill: C.red,
        detail: ['low-confidence tier', 'keep or reject'],
        caption: 'annotates, deletes nothing' },
      { label: 'Evaluation', fill: C.navy,
        detail: ['new candidates', 'specificity fixes'],
        caption: 'against the curated baseline' },
    ],
  });
  footer(s, 'Reactome-specific: template extractor, evidence comparison. Everything else is universal.', false, '');
  page(s);
})();

// ---------------------------------------------------------------- 3. Chunks
(() => {
  const s = content('Disease names rarely appear whole in a label', 'Disease chunks');
  subline(s, '47,080 EFO/MONDO terms → 21,296 diseases (drop 25,049 measurement, 735 process) → 79,582 surface forms → 249,260 scored chunks\nspecificity: rare tokens score high.    coverage: share of the full name.',
    { y: 1.78, h: 0.62 });
  table(s, {
    x: 0.6, y: 2.45, w: 12.1, fontSize: 12,
    headers: ['Disease', 'Chunk', 'Specificity', 'Coverage', 'Shared by', 'Kept'],
    colW: [2.7, 4.4, 1.4, 1.3, 1.3, 1.0],
    keyCol: 0, numCols: [2, 3, 4],
    rows: [
      ['type 2 diabetes mellitus', 'diabetes mellitus noninsulin dependent', '38.6', '1.00', '1', 'keep'],
      ['type 2 diabetes mellitus', 'type 2', '5.0', '0.30', '492', 'drop'],
      ['type 2 diabetes mellitus', '2', '3.3', '0.20', '809', 'drop'],
      ['Pendred syndrome', 'genetic defect in thyroid hormonogenesis', '32.8', '1.00', '1', 'keep'],
      ['Pendred syndrome', 'deafness', '4.4', '0.30', '253', 'drop'],
      ['cystic fibrosis', 'pseudomonas aeruginosa susceptibility', '50.8', '1.00', '1', 'keep'],
      ['cystic fibrosis', 'infection', '4.5', '0.09', '247', 'drop'],
    ],
  });
  takeaway(s, 'Unscored, matching drowns in generic fragments: "type 2" is shared by 492 diseases.');
  addLogo(s, 'light'); page(s);
})();

// ---------------------------------------------------------------- 4. Extractors
(() => {
  const s = cardList('Three extractors, in order of precedence', 'Matching Reactome labels', [
    { chip: 1, label: 'template (85)',
      items: ['Fixed label pattern', 'Disease slot is a disease by construction', 'Licenses the acronym'],
      example: 'Defective SLC26A4 causes Pendred syndrome (PDS) → Pendred syndrome' },
    { chip: 2, label: 'whole_form (171)',
      items: ['Full name or exact synonym', 'Contiguous span only', 'Fragments never match'],
      example: 'Defective SLC2A10 causes arterial tortuosity syndrome → arterial tortuosity syndrome' },
    { chip: 3, label: 'alias (95)',
      items: ['One distinctive token', 'Filtered on gene symbols and corpus sharing', 'Reviewed allow-list for acronyms'],
      example: 'Defective SERPING1 causes hereditary angioedema → angioedema' },
  ], { cardY: 2.05, cardH: 4.2 });
  subline(s, 'Matcher output: 351 pathway-disease pairs.', { y: 1.65, h: 0.3 });
  takeaway(s, 'Global abbreviation matching excluded: 10 curated links recovered, 61 collisions added.');
  page(s);
})();

// ---------------------------------------------------------------- 5. Judge
(() => {
  const s = content('An LLM judge removes context false positives', 'Optional last step');
  bullets(s, [
    'Low-confidence tier only: 151 of 351 (alias, low-specificity whole_form)',
    'Annotates keep or reject with a reason, never deletes a row',
    'Judges word sense only: broad but correct is kept',
    'Runs through the Claude Code CLI, batched and cached',
  ], { y: 1.85, h: 2.1, fontSize: 15 });
  table(s, {
    x: 0.6, y: 4.05, w: 12.1, fontSize: 12,
    headers: ['Pathway label', 'Matched', 'Why rejected'],
    colW: [4.6, 2.3, 5.2], keyCol: 0,
    rows: [
      ['Caspase activation via Dependence Receptors', 'dependence', 'receptor family, not substance dependence'],
      ['Defective POMGNT1 causes MDDGA3, MDDGB3', 'mddgc3', 'acronym for a different subtype'],
      ['Defective SLC1A3 causes episodic ataxia 6', 'episodic ataxia', 'mapped to a different ataxia'],
      ['SARS-CoV-2 activates innate immunity', 'sars', 'SARS-CoV-2 causes COVID-19, not SARS'],
    ],
  });
  footer(s, '6 of 151 rejected. Broad but valid kept, for example "Viral Infection Pathways".', false, '');
  addLogo(s, 'light'); page(s);
})();

// ================================================================ PART 2
sectionDivider(pres, { part: 'Part 2', title: 'What it finds in Reactome' });

// ---------------------------------------------------------------- 6. New links
(() => {
  const s = content('258 new links, absent from current curation', 'Results', { fontSize: 34 });
  s.addChart(pres.ChartType.bar, [{
    name: 'Pairs',
    labels: ['Matcher output', 'Kept by the judge', 'New links'],
    values: [351, 345, 258],
  }], {
    x: 0.5, y: 2.1, w: 6.9, h: 4.0, barDir: 'bar',
    showTitle: false, showLegend: false, showValue: true, dataLabelPosition: 'outEnd',
    dataLabelColor: C.grey, dataLabelFontFace: BODY_FONT, dataLabelFontSize: 12,
    chartColors: [C.blue],
    catAxisLabelColor: C.grey, catAxisLabelFontFace: BODY_FONT, catAxisLabelFontSize: 12,
    valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    valAxisMaxVal: 420, barGapWidthPct: 60,
  });
  bullets(s, [
    '190 pathways, 175 diseases',
    'Roughly 600 to 900 new target-disease pairs',
    'Median new pathway: 1 gene',
    'Tail: SARS therapeutics 154 genes, MLL4/MLL3 134',
    '930 raw, about 580 excluding pathways over 50 genes',
  ], { x: 7.8, y: 2.3, w: 5.0, h: 3.6, fontSize: 15 });
  footer(s, REL, false, '');
  addLogo(s, 'light'); page(s);
})();

// ---------------------------------------------------------------- 7. Recovery
(() => {
  const s = bigStat(pres, {
    number: '18.7%',
    caption: 'of the 653 curated pathway-disease pairs recovered',
    ref: `531 not recovered. ${REL}`,
    onDark: false,
  });
  bullets(s, [
    '88 exact, 28 more specific, 6 more general',
    'Curators assign disease from biology, not from label text',
    'Complementary, not nested: the denominator is the label-nameable subset',
  ], { x: 1.0, y: 5.15, w: 10.6, h: 1.4, fontSize: 14 });
  page(s);
})();

// ---------------------------------------------------------------- 8. Non-recovery
(() => {
  const s = cardList('Why the other 531 are not recovered', 'One example per reason', [
    { label: 'A. No disease in label',
      items: ['The large majority', 'Label is pure biology', 'Curated disease comes from gene knowledge', 'Unreachable by any label method'],
      example: '"Signaling by plasma membrane FGFR1 fusions" → cancer' },
    { label: 'B. Colliding acronym',
      items: ['Correctly refused', 'Free acronym matching costs 6:1'],
      example: '"NOTCH1 HD Domain Mutants": HD is the HD domain, not Huntington disease' },
    { label: 'C. A different disease',
      items: ['Not a miss, a disagreement', 'Matcher term is often more precise', 'Ontology graph does not link it to the parent'],
      example: '"MyD88 deficiency (TLR5)" → pyogenic bacterial infection, curated: inborn error of immunity' },
  ]);
  takeaway(s, 'Strip out A and B, unreachable and correctly refused, and the true missed set is small.');
  page(s);
})();

// ---------------------------------------------------------------- 9. Specificity
(() => {
  const s = content('It also tightens existing curation', 'Bonus');
  subline(s, '44 specificity improvements: the label names the subtype, the curation recorded the parent.',
    { y: 1.78, h: 0.4 });
  table(s, {
    x: 0.6, y: 2.35, w: 12.1, fontSize: 12,
    headers: ['Pathway label', 'Matcher (specific)', 'Curated (broad)'],
    colW: [4.5, 4.0, 3.6], keyCol: 0,
    rows: [
      ['Defective B4GALT1 causes B4GALT1-CDG', 'B4GALT1-congenital disorder of glycosylation', 'congenital disorder of glycosylation type II'],
      ['Defective SLC24A5 causes oculocutaneous albinism 6', 'oculocutaneous albinism type 6', 'oculocutaneous albinism'],
      ['Defective PMM2 causes PMM2-CDG', 'PMM2-congenital disorder of glycosylation', 'congenital disorder of glycosylation type I'],
      ['Defective CHST14 causes EDS, musculocontractural type', 'Ehlers-Danlos syndrome, musculocontractural type', 'Ehlers-Danlos syndrome'],
    ],
  });
  takeaway(s, 'A second output type: tighten annotations, not only add them.', 5.2);
  footer(s, REL, false, '');
  addLogo(s, 'light'); page(s);
})();

// ================================================================ PART 3
sectionDivider(pres, { part: 'Part 3', title: 'Does it generalise?' });

// ---------------------------------------------------------------- 10. GO
(() => {
  const s = cardList('GO runs through the same code, two layers off', 'Extending to GO biological processes', [
    { label: 'What it yields',
      items: ['24,136 non-obsolete labels', '165 pairs, 15 diseases', '138 whole_form, 27 alias, 0 template', 'Judge: 141 kept, 24 rejected'] },
    { label: 'What does not apply',
      items: ['template: GO has no such labels', 'No GO-disease evidence, so no baseline', 'Every match is a candidate', 'Genes from target.go, aspect P'] },
    { label: 'What it taught us',
      items: ['GO describes processes, not disease pathways', '0.3% of labels carry a disease cue', 'Judge rejects 31%, against 7% on Reactome'],
      example: '"type III hypersensitivity" → IgE responsiveness\n"reactive gliosis" → Gliosis' },
  ]);
  takeaway(s, 'On GO the judge is essential, not optional. Output is review-first, not curation-ready.');
  page(s);
})();

// ---------------------------------------------------------------- 11. Model comparison
(() => {
  const s = content('The judge is the one non-deterministic layer', 'Haiku, Sonnet, Opus');
  table(s, {
    x: 0.6, y: 1.95, w: 12.1, fontSize: 12,
    headers: ['Model', 'Reactome rejects', 'False rejects', 'GO rejects', '$ / 1M in', '$ / 1M out'],
    colW: [3.1, 2.2, 1.9, 1.9, 1.5, 1.5],
    keyCol: 0, numCols: [1, 2, 3, 4, 5],
    rows: [
      ['Claude Haiku 4.5', '6', '2', '37', '1.00', '5.00'],
      ['Claude Sonnet 5 (default)', '11', '1', '24', '3.00', '15.00'],
      ['Claude Opus 4.8', '8', '1', '21', '5.00', '25.00'],
    ],
  });
  bullets(s, [
    'Agreement: 137 of 151 on Reactome (91%), 60 of 77 on GO (78%)',
    'Reactome splits: the "sars" alias, and hypoxia as process or disease',
    'GO flips: Haiku strictest, rejects on tissue (cardiac vs skeletal hypertrophy)',
    'Safeguard: false-reject check against curated evidence, plus human review',
  ], { y: 4.15, h: 2.3, fontSize: 15 });
  footer(s, 'Anthropic list prices, USD per 1M tokens. Sonnet 5 has an introductory rate to 2026-08-31.', false, '');
  addLogo(s, 'light'); page(s);
})();

// ---------------------------------------------------------------- 12. EFO error
(() => {
  const s = content('The judge caught an error in the ontology', 'A case worth showing');
  node(s, { x: 0.6, y: 2.05, w: 5.3, h: 0.95,
    label: 'Defective SLC1A3 causes episodic ataxia 6 (EA6)', fill: C.blue, fontSize: 13 });
  arrow(s, 6.05, 2.52, 6.85, 2.52);
  coralBox(s, { x: 7.0, y: 2.05, w: 5.3, h: 0.95,
    label: 'Isaacs syndrome  (EFO_1000638)', fontSize: 13 });
  s.addText('all three models rejected this pair', {
    x: 0.6, y: 3.05, w: 11.7, h: 0.35, fontFace: BODY_FONT, fontSize: 12, color: C.grey,
    align: 'center' });
  bullets(s, [
    'Looks like a false reject: Open Targets evidence holds the same pair',
    'The evidence made the same error: diseaseFromSource "episodic ataxia"',
    'EFO_1000638 (Isaacs syndrome, a neuromyotonia) carries "episodic ataxia" as an exact synonym',
    'Correct term kept for the same pathway: hereditary episodic ataxia (MONDO_0016227)',
  ], { y: 3.75, h: 2.4, fontSize: 15 });
  takeaway(s, 'The reject list is a candidate list of ontology synonym errors, actionable in EFO.', 6.4);
  addLogo(s, 'light'); page(s);
})();

// ---------------------------------------------------------------- 13. Enrichr libraries
(() => {
  const s = content('Scaling out to all public pathway libraries', 'Enrichr');
  subline(s, '228 Enrichr libraries → curated Pathways category, latest version, excluding Reactome, GO and mouse → 12 libraries. Labels and gene sets ship in one GMT file, so gene membership needs no join.',
    { y: 1.78, h: 0.55 });
  table(s, {
    x: 0.6, y: 2.45, w: 12.1, fontSize: 12,
    headers: ['Library', 'What it is'],
    colW: [4.3, 7.8], keyCol: 0,
    rows: [
      ['KEGG_2026', 'metabolic, signalling and human-disease pathways'],
      ['WikiPathways_2024_Human', 'community-curated biological pathways'],
      ['Elsevier_Pathway_Collection', 'commercially curated disease-mechanism pathways'],
      ['BioPlanet_2019', 'NCATS, integrated and deduplicated human pathways'],
      ['BioCarta / NCI-Nature / Panther', 'legacy maps, PID signalling, PANTHER classification'],
      ['HumanCyc / PFOCR', 'human metabolic pathways, gene sets mined from figures'],
      ['MSigDB (3 collections)', 'hallmark states, computational modules, oncogenic signatures'],
    ],
  });
  footer(s, 'maayanlab.cloud/Enrichr', false, '');
  addLogo(s, 'light'); page(s);
})();

// ---------------------------------------------------------------- 14. Enrichr results
(() => {
  const s = content('1,118 links across 12 pathway libraries', 'Enrichr results');
  s.addChart(pres.ChartType.bar, [{
    name: 'Kept links',
    labels: ['Elsevier', 'WikiPathways', 'BioPlanet', 'KEGG', 'BioCarta', 'Panther', 'NCI-Nature', 'MSigDB Hallmark'],
    values: [737, 179, 91, 88, 13, 5, 3, 2],
  }], {
    x: 0.5, y: 2.0, w: 7.0, h: 4.3, barDir: 'bar',
    showTitle: false, showLegend: false, showValue: true, dataLabelPosition: 'outEnd',
    dataLabelColor: C.grey, dataLabelFontFace: BODY_FONT, dataLabelFontSize: 12,
    chartColors: [C.blue],
    catAxisLabelColor: C.grey, catAxisLabelFontFace: BODY_FONT, catAxisLabelFontSize: 12,
    valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    valAxisMaxVal: 850, barGapWidthPct: 60,
  });
  bullets(s, [
    '1,144 matches, 1,118 kept (2.3% rejected)',
    '349 diseases, about 36,700 target-disease pairs',
    'Elsevier: 737 of 1,118, naming convention "X in Disease Y"',
    'PFOCR (21,845 terms): zero, its terms are figure IDs',
    'HumanCyc and MSigDB modules: zero, correctly',
    'Reject rate is Reactome-like, not GO-like',
  ], { x: 7.8, y: 2.2, w: 5.0, h: 4.0, fontSize: 14 });
  footer(s, 'Enrichr pathway libraries, judged with Claude Sonnet 5.', false, '');
  addLogo(s, 'light'); page(s);
})();

// ---------------------------------------------------------------- 15. Conclusion
(() => {
  const s = pres.addSlide();
  s.background = { color: C.paper };
  contentTitle(s, 'Why integrate this pipeline', { kicker: 'Conclusion' });
  const rows = [
    ['Scale', '258 new links, 600 to 900 new target-disease pairs, 44 specificity fixes'],
    ['No new data', 'All from datasets Open Targets already ships'],
    ['Already extended', 'GO: 141 kept.  12 Enrichr libraries: 1,118 kept'],
    ['Universal', 'New gene-set resources plug in with no method change'],
    ['Demonstrated need', 'Neuroflux and Neuroid, where coverage was limiting'],
  ];
  const y0 = 2.15, step = 0.92;
  rows.forEach(([head, body], i) => {
    const y = y0 + i * step;
    s.addShape('ellipse', { x: 0.65, y: y + 0.04, w: 0.5, h: 0.5,
      fill: { color: C.blue }, line: { type: 'none' } });
    s.addText(String(i + 1), { x: 0.65, y: y + 0.04, w: 0.5, h: 0.5, margin: 0,
      fontFace: TITLE_FONT, fontSize: 16, bold: true, color: C.paper,
      align: 'center', valign: 'middle' });
    s.addText(head, { x: 1.35, y, w: 3.0, h: 0.42, fontFace: LABEL_FONT, fontSize: 17,
      color: C.navy, valign: 'middle' });
    s.addText(body, { x: 4.5, y, w: 8.0, h: 0.42, fontFace: BODY_FONT, fontSize: 15,
      color: C.ink, valign: 'middle' });
    if (i < rows.length - 1) {
      s.addShape('line', { x: 1.35, y: y + 0.66, w: 11.15, h: 0,
        line: { color: 'E4E9F0', width: 1 } });
    }
  });
  addLogo(s, 'light'); page(s);
})();

pres.writeFile({ fileName: 'disease-pathways.pptx' }).then((f) => console.log('wrote', f));
