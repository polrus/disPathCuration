// Open Targets house-style deck for the disPathCuration talk.
// Content follows docs/presentation-plan.md; judge figures verified against
// data/26.06/matches_judged_reactome.csv, chunk figures against
// data/26.06/disease_chunks.csv.
// Copy is bullet fragments, minimum text size 12pt, no slide numbers.
// Build: node generate.js -> disease-pathways.pptx
const pptxgen = require('pptxgenjs');
const T = require('./theme.js');
const {
  C, TITLE_FONT, BODY_FONT, LABEL_FONT,
  titleSlide, sectionDivider, table, schemaSlide,
  contentTitle, addLogo, footer, node, coralBox, arrow, chip,
} = T;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'Polina Rusina';
pres.title = 'Automatic extraction of disease pathways';

const GREEN = '1E6B33', GREEN30 = 'DDF0E2';
const RED_TEXT = 'A33224';

// ---------------------------------------------------------------- helpers
function bullets(s, items, o = {}) {
  s.addText(
    items.map((t) => (typeof t === 'string'
      ? { text: t, options: { breakLine: true, bullet: true } }
      : { ...t, options: { breakLine: true, bullet: true, ...(t.options || {}) } })),
    {
      x: o.x ?? 0.6, y: o.y ?? 2.0, w: o.w ?? 12.1, h: o.h ?? 4.2,
      fontFace: BODY_FONT, fontSize: o.fontSize ?? 16, color: o.color ?? C.ink,
      valign: 'top', lineSpacing: (o.fontSize ?? 16) * 1.6,
      bullet: { code: '2022', indent: 16 },
    },
  );
}

function subline(s, text, o = {}) {
  s.addText(text, {
    x: 0.6, y: o.y ?? 1.8, w: o.w ?? 12.1, h: o.h ?? 0.5, fontFace: BODY_FONT,
    fontSize: o.fontSize ?? 13, color: o.color ?? C.grey, valign: 'top', lineSpacing: 19,
  });
}

function takeaway(s, text, y = 6.55) {
  s.addText(text, {
    x: 0.6, y, w: 10.8, h: 0.45, fontFace: LABEL_FONT, fontSize: 14, bold: true,
    color: C.blue, valign: 'middle', lineSpacing: 18,
  });
}

// A soft rounded label. Used for ontology terms, label fragments, verdicts.
function pill(s, o) {
  s.addShape('roundRect', { x: o.x, y: o.y, w: o.w, h: o.h ?? 0.34, rectRadius: 0.08,
    fill: { color: o.fill ?? C.blue30 }, line: { type: 'none' } });
  s.addText(o.text, { x: o.x, y: o.y, w: o.w, h: o.h ?? 0.34, margin: 2,
    fontFace: o.font ?? BODY_FONT, fontSize: o.fontSize ?? 12, bold: o.bold ?? false,
    color: o.color ?? C.navy, align: o.align ?? 'center', valign: 'middle' });
}

// Panels are fills, never outlines: no box in this deck carries a stroke.
function card(s, o) {
  s.addShape('roundRect', { x: o.x, y: o.y, w: o.w, h: o.h, rectRadius: 0.06,
    fill: { color: o.fill ?? 'F4F6F9' }, line: { type: 'none' } });
}

function content(title, kicker, opts = {}) {
  const s = pres.addSlide();
  s.background = { color: C.paper };
  contentTitle(s, title, { kicker, fontSize: opts.fontSize });
  return s;
}

// Section divider. Same build as theme.sectionDivider, at a size that takes a
// full problem statement in two lines without running into the diagonal.
function divider(part, title) {
  const s = pres.addSlide();
  s.background = { color: C.paper };
  T.diagonal(s, C.navy, 'br');
  const cy = 2.6;
  s.addShape('rect', { x: 0.6, y: cy + 0.06, w: 0.28, h: 0.28, fill: { color: C.blue }, line: { type: 'none' } });
  s.addText(part.toUpperCase(), { x: 1.0, y: cy, w: 6, h: 0.45, fontFace: LABEL_FONT,
    fontSize: 15, color: C.blue, charSpacing: 2, valign: 'middle' });
  s.addText(title, { x: 0.58, y: cy + 0.4, w: 7.2, h: 2.7, fontFace: T.SLIDE_TITLE_FONT,
    fontSize: 34, bold: true, color: C.navy, valign: 'top', lineSpacing: 40 });
  addLogo(s, 'light');
  return s;
}

// A single question, held on screen. Deliberately NOT the divider furniture: a
// question is a pause inside a part, not the start of one. Inverted instead,
// borrowing the big-stat slide's navy ground and slim blue accent bar.
function questionSlide(question) {
  const s = pres.addSlide();
  s.background = { color: C.navy };
  s.addShape('custGeom', {
    x: 0, y: 0, w: T.W, h: T.H, line: { type: 'none' }, fill: { color: '234E70' },
    points: [{ x: T.W, y: T.H * 0.45 }, { x: T.W, y: T.H }, { x: T.W * 0.68, y: T.H }, { close: true }],
  });
  s.addShape('rect', { x: 0.6, y: 2.85, w: 0.14, h: 1.5, fill: { color: C.blue }, line: { type: 'none' } });
  s.addText(question, { x: 0.98, y: 2.7, w: 10.0, h: 1.9, fontFace: T.SLIDE_TITLE_FONT,
    fontSize: 44, bold: true, color: C.paper, valign: 'top', lineSpacing: 52 });
  addLogo(s, 'dark');
  return s;
}

// A row of pathway libraries drawn as classical library buildings. `state` maps
// a name to 'done' (already read), 'now' (this slide's subject) or 'off'.
const LIBRARIES = ['Reactome', 'GO', 'KEGG', 'WikiPathways', 'Elsevier', 'BioPlanet',
  'BioCarta', 'NCI-Nature', 'Panther', 'MSigDB'];

function skyline(s, state, y = 2.35, h = 2.55) {
  const n = LIBRARIES.length, gap = 0.1;
  const w = (T.W - 1.2 - (n - 1) * gap) / n;
  const TONE = { done: C.navy, now: C.blue, off: 'DDE2EA' };
  LIBRARIES.forEach((name, i) => {
    const x = 0.6 + i * (w + gap);
    const kind = state[name] || 'off';
    const fill = { color: TONE[kind] }, ped = 0.32, stepH = 0.09;
    s.addShape('custGeom', { x, y, w, h: ped, fill, line: { type: 'none' },
      points: [{ x: 0, y: ped }, { x: w / 2, y: 0 }, { x: w, y: ped }, { close: true }] });
    s.addShape('rect', { x, y: y + ped, w, h: h - ped - stepH, fill, line: { type: 'none' } });
    // three white gaps read as four columns at this size
    for (let c = 1; c <= 3; c += 1) {
      s.addShape('rect', { x: x + c * (w / 4) - 0.022, y: y + ped + 0.1, w: 0.044,
        h: h - ped - stepH - 0.24, fill: { color: C.paper }, line: { type: 'none' } });
    }
    s.addShape('rect', { x: x - 0.05, y: y + h - stepH, w: w + 0.1, h: stepH, fill, line: { type: 'none' } });
    s.addText(name, { x: x - 0.08, y: y + h + 0.12, w: w + 0.16, h: 0.3, fontFace: LABEL_FONT,
      fontSize: 12, color: kind === 'off' ? C.grey : C.navy, align: 'center' });
  });
}

const REL = 'Open Targets Platform release 26.06.';

// ================================================================ Title
titleSlide(pres, {
  title: 'Automatic extraction of disease pathways',
  meta: ['Presented by', 'Polina Rusina'],
});

// ================================================================ PART 1
divider('Part 1', 'Automatic target-disease evidence extraction from Reactome pathways');

// ---------------------------------------------------------------- Problem
// The library is the slide's ground: shelving bleeds off the top and both sides
// and the title sits on it, so the top row is kept pale to stay legible behind
// the type. The metaphor is the method: books sharing a word in the title are
// what we are after. The curator carries three off, leaving gaps where they
// stood, and walks past three more. Native shapes, so every book stays
// selectable in PowerPoint. Seeded, so it redraws identically.
(() => {
  const s = pres.addSlide();
  s.background = { color: C.paper };

  const ROWS = 4, PITCH = 1.5667, FIRST = 1.90;
  const BAY = 6.0, TEXT_X = 7.2, PLANK = 'B9BEC6', SPINE_W = 0.44, SPINE_H = 1.45;
  const plankOf = (r) => FIRST + r * PITCH;
  const BOT = plankOf(ROWS - 1);

  const SHELF = [
    { r: 1, x: 3.05, title: 'How to Train Your Dragon' },
    { r: 1, x: 4.55, title: 'A Dance with Dragons' },
    { r: 2, x: 3.40, title: 'The Girl with the Dragon Tattoo' },
    { r: 2, x: 4.90, title: 'Dragons of Autumn Twilight' },
    { r: 3, x: 4.25, title: 'The Flight of Dragons' },
  ];
  const GAPS = [{ r: 1, x: 5.25 }, { r: 2, x: 2.75 }, { r: 3, x: 3.15 }];
  const blocked = (r) => [
    ...SHELF.filter((b) => b.r === r).map((b) => [b.x, b.x + SPINE_W]),
    ...GAPS.filter((g) => g.r === r).map((g) => [g.x, g.x + 0.5]),
  ];

  let seed = 20260827;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const NEAR = ['D5DAE2', 'DDE2EA', 'CBD2DC', 'E1E5EB'];
  const MID = ['E1E5EB', 'E7EAEF', 'DDE2EA'];
  const FAR = ['F0F2F5', 'F4F6F8', 'EDEFF3'];

  for (let r = 0; r < ROWS; r += 1) {
    const plankY = plankOf(r), stop = blocked(r);
    s.addShape('rect', { x: 0, y: plankY, w: BAY, h: 0.06, fill: { color: C.navy }, line: { type: 'none' } });
    s.addShape('rect', { x: BAY, y: plankY, w: TEXT_X - BAY, h: 0.06, fill: { color: PLANK }, line: { type: 'none' } });
    s.addShape('rect', { x: TEXT_X, y: plankY, w: T.W - TEXT_X, h: 0.06, fill: { color: 'E6E9ED' }, line: { type: 'none' } });
    let x = 0.08;
    while (x < 13.2) {
      const bw = 0.15 + rnd() * 0.15, bh = 0.85 + rnd() * 0.62;
      const hit = stop.find(([a, b]) => x < b && x + bw > a);
      if (hit) { x = hit[1] + 0.03; continue; }          // step over spines and gaps
      // the top row stays pale everywhere: the title sits on it
      const tone = r === 0 ? pick(FAR) : x < BAY ? pick(NEAR) : x < TEXT_X ? pick(MID) : pick(FAR);
      s.addShape('rect', { x, y: plankY - bh, w: bw, h: bh, fill: { color: tone }, line: { type: 'none' } });
      x += bw + 0.02 + rnd() * 0.03;
    }
  }
  // the bay upright starts at the first plank, clear of the title above it
  s.addShape('rect', { x: BAY, y: FIRST, w: 0.07, h: BOT - FIRST + 0.06, fill: { color: C.navy }, line: { type: 'none' } });

  // Bolding the shared word mirrors the match highlight used later in the deck.
  const runs = (t) => t.split(/(Dragon)/).filter(Boolean)
    .map((part) => ({ text: part, options: { bold: part === 'Dragon' } }));
  SHELF.forEach((b) => {
    const by = plankOf(b.r) - SPINE_H;
    s.addShape('rect', { x: b.x, y: by, w: SPINE_W, h: SPINE_H, fill: { color: C.blue }, line: { type: 'none' } });
    // rotated about its own centre, so the box is laid out landscape and re-centred
    s.addText(runs(b.title), { x: b.x + SPINE_W / 2 - SPINE_H / 2, y: by + SPINE_H / 2 - SPINE_W / 2,
      w: SPINE_H, h: SPINE_W, margin: 0, rotate: 270, fontFace: BODY_FONT, fontSize: 12,
      color: C.paper, align: 'center', valign: 'middle', lineSpacing: 14 });
  });

  // The curator, carrying three more of the same.
  const fx = 1.15, feet = BOT, k = 1.45, navy = { color: C.navy };
  const box = (dx, up, w, h, rr) => s.addShape(rr ? 'roundRect' : 'rect', {
    x: fx + dx * k, y: feet - up * k, w: w * k, h: h * k,
    ...(rr ? { rectRadius: rr * k } : {}), fill: navy, line: { type: 'none' } });
  box(0.50, 1.12, 0.15, 1.12, 0.07);
  box(0.72, 1.12, 0.15, 1.12, 0.07);
  box(0.33, 1.88, 0.12, 0.66, 0.06);
  box(0.90, 1.88, 0.12, 0.66, 0.06);
  box(0.45, 1.96, 0.44, 0.86, 0.16);
  s.addShape('ellipse', { x: fx + 0.50 * k, y: feet - 2.38 * k, w: 0.34 * k, h: 0.34 * k,
    fill: navy, line: { type: 'none' } });
  ['Red Dragon', 'Dragon Rider', 'The Last Dragon'].forEach((title, n) => {
    const by = 4.60 + n * 0.36;
    s.addShape('rect', { x: 1.35, y: by, w: 1.55, h: 0.32, fill: { color: C.blue }, line: { type: 'none' } });
    s.addText(runs(title), { x: 1.39, y: by, w: 1.47, h: 0.32, margin: 0, fontFace: BODY_FONT,
      fontSize: 12, color: C.paper, align: 'center', valign: 'middle' });
  });
  s.addShape('roundRect', { x: 1.31, y: 5.67, w: 1.63, h: 0.17, rectRadius: 0.085, fill: navy, line: { type: 'none' } });

  // The three gaps, over the faded half of the picture. No figures quoted: every
  // number on this slide would be a result the talk has not reached yet.
  [['Curation is incomplete', 'Labels that name a disease, and nothing follows'],
   ['And it has stopped', 'Reactome left EMBL-EBI, so nothing new is added'],
   ['And it is one library of many', 'Every other pathway database is untouched'],
  ].forEach(([head, body], n) => {
    const y = 2.32 + n * 1.57;
    s.addShape('ellipse', { x: 7.6, y, w: 0.44, h: 0.44, fill: { color: C.blue }, line: { type: 'none' } });
    s.addText(String(n + 1), { x: 7.6, y, w: 0.44, h: 0.44, margin: 0, fontFace: TITLE_FONT,
      fontSize: 15, bold: true, color: C.paper, align: 'center', valign: 'middle' });
    s.addText(head, { x: 8.22, y: y - 0.03, w: 4.5, h: 0.36, fontFace: LABEL_FONT, fontSize: 17,
      color: C.navy, valign: 'middle' });
    s.addText(body, { x: 8.22, y: y + 0.38, w: 4.5, h: 0.5, fontFace: BODY_FONT, fontSize: 13,
      color: C.ink, valign: 'top', lineSpacing: 18 });
  });

  // Title last, so it sits over the shelving. No kicker.
  contentTitle(s, 'Three gaps in pathway-derived evidence');
  addLogo(s, 'light');
})();

// ---------------------------------------------------------------- Pipeline schema
// The overview, kept deliberately thin: one generic object per stage and one
// caption. Which of the three extractors fires is the next slides' business,
// so lane 2 shows only that the fragment turns up in a label.
(() => {
  const s = schemaSlide(pres, { title: 'Automatic extraction of disease pathways from Reactome' });
  const mx = 0.6, gap = 0.34, n = 4;
  const laneW = (T.W - 2 * mx - (n - 1) * gap) / n;
  const headY = 1.5, headH = 0.75, bodyY = 2.5, bodyH = 3.1;
  const stages = [
    { label: 'Disease names', fill: C.blue },
    { label: 'Find in label', fill: C.blue },
    { label: 'Check in context', fill: C.red, llm: true },
    { label: 'Evidence', fill: C.navy },
  ];
  stages.forEach((st, i) => {
    const x = mx + i * (laneW + gap);
    card(s, { x, y: bodyY, w: laneW, h: bodyH });
    node(s, { x, y: headY, w: laneW, h: headH, label: st.label, fill: st.fill, fontSize: 14 });
    if (st.llm) pill(s, { x: x + laneW - 0.85, y: headY - 0.22, w: 0.8, h: 0.3, text: 'LLM',
      fill: C.navy, color: C.paper, font: LABEL_FONT });
    if (i < n - 1) arrow(s, x + laneW, headY + headH / 2, x + laneW + gap, headY + headH / 2);
  });
  const lx = (i) => mx + i * (laneW + gap);
  const pad = 0.22, iw = laneW - pad * 2;
  const ROW = (i) => bodyY + 0.45 + i * 0.55;
  const foot = (i, text) => s.addText(text, { x: lx(i) + pad, y: bodyY + bodyH - 0.62, w: iw, h: 0.55,
    fontFace: BODY_FONT, fontSize: 12, color: C.grey, align: 'center', valign: 'top', lineSpacing: 15 });

  // 1. a disease becomes one searchable fragment
  pill(s, { x: lx(0) + pad, y: ROW(0), w: iw, h: 0.42, text: 'Disease X', fill: C.navy, color: C.paper, font: LABEL_FONT });
  pill(s, { x: lx(0) + pad, y: ROW(1), w: iw, h: 0.42, text: 'synonym of X', fill: C.blue30 });
  pill(s, { x: lx(0) + pad, y: ROW(2), w: iw, h: 0.42, text: 'whole form of X', fill: GREEN30, color: GREEN });
  foot(0, 'every name and synonym, cut and scored');

  // 2. that fragment turns up inside a pathway label
  s.addShape('roundRect', { x: lx(1) + pad, y: ROW(0), w: iw, h: 0.6, rectRadius: 0.06,
    fill: { color: C.paper }, line: { type: 'none' } });
  s.addText([
    { text: 'Gene X is dysregulated in ', options: { color: C.grey } },
    { text: 'Disease X', options: { color: C.navy, bold: true } },
  ], { x: lx(1) + pad + 0.1, y: ROW(0), w: iw - 0.2, h: 0.6, fontFace: BODY_FONT, fontSize: 12,
    valign: 'middle', lineSpacing: 15 });
  foot(1, 'exact strings only, no fuzzy matching');

  // 3. the judge reads only the doubtful ones
  pill(s, { x: lx(2) + pad, y: ROW(0), w: iw, h: 0.42, text: 'kept: X is the disease', fill: GREEN30, color: GREEN });
  pill(s, { x: lx(2) + pad, y: ROW(1), w: iw, h: 0.42, text: 'rejected: X is a protein', fill: C.red30, color: RED_TEXT });
  foot(2, 'word sense only, nothing is deleted');

  // 4. every gene in the pathway gains the link
  pill(s, { x: lx(3) + pad, y: ROW(0), w: iw, h: 0.42, text: 'Gene X  -  Disease X', fill: C.navy, color: C.paper, font: LABEL_FONT });
  pill(s, { x: lx(3) + pad, y: ROW(1), w: iw, h: 0.42, text: 'new link', fill: C.blue30 });
  pill(s, { x: lx(3) + pad, y: ROW(2), w: iw, h: 0.42, text: 'already curated', fill: 'E8EBF0', color: C.grey });
  foot(3, 'set against curation, then reviewed');
})();

// ---------------------------------------------------------------- Chunks
// One real case end to end. Every string and number here is from release 26.06:
// chunk scores from disease_chunks.csv, the label and genes from R-HSA-9036092.
// The two dropped spans are chosen to show both rejection reasons: one scores
// well but is not the whole form, the other is simply too common.
(() => {
  const s = content('How a disease name becomes target-disease evidence', 'Worked example', { fontSize: 32 });
  subline(s, 'One real case, traced end to end. Open Targets derives no evidence for this disease from this pathway today, so the link is new.',
    { y: 1.68, h: 0.3 });

  const cw = 3.74, gap = 0.45, cy = 2.25, ch = 3.55, pad = 0.3;
  const head = (i, n, name, sub) => {
    const x = 0.6 + i * (cw + gap);
    card(s, { x, y: cy, w: cw, h: ch });
    s.addShape('ellipse', { x: x + pad, y: cy + 0.26, w: 0.44, h: 0.44, fill: { color: C.blue }, line: { type: 'none' } });
    s.addText(String(n), { x: x + pad, y: cy + 0.26, w: 0.44, h: 0.44, margin: 0, fontFace: TITLE_FONT,
      fontSize: 14, bold: true, color: C.paper, align: 'center', valign: 'middle' });
    s.addText(name, { x: x + pad + 0.6, y: cy + 0.28, w: cw - pad * 2 - 0.6, h: 0.4, fontFace: LABEL_FONT,
      fontSize: 15, color: C.navy, valign: 'middle' });
    s.addText(sub, { x: x + pad, y: cy + 0.8, w: cw - pad * 2, h: 0.3, fontFace: BODY_FONT,
      fontSize: 12, color: C.grey });
    return x;
  };
  const iw = cw - pad * 2;
  const note = (x, y, t) => s.addText(t, { x: x + pad, y, w: iw, h: 0.25, fontFace: BODY_FONT,
    fontSize: 12, color: C.grey, align: 'center' });

  let x = head(0, 1, 'Expand', 'name plus exact synonyms');
  pill(s, { x: x + pad, y: cy + 1.2, w: iw, h: 0.42, text: 'Central diabetes insipidus',
    fill: C.navy, color: C.paper, font: LABEL_FONT });
  note(x, cy + 1.64, 'HP_0000863');
  arrow(s, x + cw / 2, cy + 1.95, x + cw / 2, cy + 2.11);
  pill(s, { x: x + pad, y: cy + 2.15, w: iw, h: 0.42, text: 'neurohypophyseal diabetes insipidus', fill: C.blue30 });
  note(x, cy + 2.59, 'its one exact synonym');

  x = head(1, 2, 'Cut and score', 'six spans, one survives');
  pill(s, { x: x + pad, y: cy + 1.2, w: iw, h: 0.62, fill: GREEN30, color: GREEN,
    text: 'neurohypophyseal diabetes insipidus\n22.3   coverage 1.00   shared by 2' });
  pill(s, { x: x + pad, y: cy + 1.92, w: iw, h: 0.55, fill: C.red30, color: RED_TEXT,
    text: 'neurohypophyseal diabetes\n14.7   coverage 0.66' });
  pill(s, { x: x + pad, y: cy + 2.57, w: iw, h: 0.55, fill: C.red30, color: RED_TEXT,
    text: 'diabetes\n5.4   shared by 97' });
  note(x, cy + 3.18, 'and three more spans dropped');

  x = head(2, 3, 'Match', 'and every gene in that pathway');
  s.addShape('roundRect', { x: x + pad, y: cy + 1.2, w: iw, h: 0.85, rectRadius: 0.06,
    fill: { color: C.paper }, line: { type: 'none' } });
  s.addText([
    { text: 'Defective AVP does not bind AVPR2 and causes ', options: { color: C.grey } },
    { text: 'neurohypophyseal diabetes insipidus', options: { color: C.navy, bold: true } },
    { text: ' (NDI)', options: { color: C.grey } },
  ], { x: x + pad + 0.12, y: cy + 1.2, w: iw - 0.24, h: 0.85, fontFace: BODY_FONT, fontSize: 12,
    valign: 'middle', lineSpacing: 15 });
  arrow(s, x + cw / 2, cy + 2.09, x + cw / 2, cy + 2.25);
  pill(s, { x: x + pad, y: cy + 2.29, w: iw, h: 0.42, text: 'AVP  -  central diabetes insipidus',
    fill: C.navy, color: C.paper, font: LABEL_FONT });
  pill(s, { x: x + pad, y: cy + 2.77, w: iw, h: 0.42, text: 'AVPR2  -  central diabetes insipidus',
    fill: C.navy, color: C.paper, font: LABEL_FONT });
  note(x, cy + 3.21, 'two new target-disease links');

  s.addShape('roundRect', { x: 0.6, y: 5.95, w: 12.1, h: 0.78, rectRadius: 0.08,
    fill: { color: C.navy }, line: { type: 'none' } });
  pill(s, { x: 0.9, y: 6.16, w: 1.35, h: 0.36, text: 'Rule', fill: C.blue, color: C.paper, font: LABEL_FONT });
  s.addText('A word\'s rarity is the log of all diseases divided by those that use it, so diabetes scores 5.4 and neurohypophyseal 9.3. A span scores the sum of its words, and is kept only as a whole form scoring 8.0, or 9.0 if it stands alone.', {
    x: 2.45, y: 5.95, w: 9.9, h: 0.78, fontFace: LABEL_FONT, fontSize: 14, bold: true,
    color: C.paper, valign: 'middle' });
  addLogo(s, 'light');
})();

// ---------------------------------------------------------------- Ask the room
questionSlide('In a pathway label, what does HD mean?');

// ---------------------------------------------------------------- Extractors
// Three alternatives competing for the same input, so they read as rows over
// one label rather than three unrelated cards.
(() => {
  const s = content('A disease reaches a label in three ways', 'Matching Reactome labels');
  subline(s, 'They differ in what has to appear in the label: a known shape, a complete name, or one distinctive word.',
    { y: 1.68, h: 0.3 });

  const specs = [
    { n: '1', label: 'Fixed pattern', count: '85 pathway-disease links',
      pre: 'Defective ABCC6 causes ', hit: 'PXE', post: '', out: 'pseudoxanthoma elasticum',
      rule: 'One of four fixed shapes. The slot holds a disease by construction, so even a bare acronym is safe to read.' },
    { n: '2', label: 'Complete name', count: '171 pathway-disease links',
      pre: '', hit: 'Fanconi Anemia', post: ' Pathway', out: 'Fanconi anemia',
      rule: 'No fixed shape. The complete name or an exact synonym turns up somewhere in the label, in one span.' },
    { n: '3', label: 'Single word', count: '95 pathway-disease links',
      pre: 'Uptake and function of ', hit: 'diphtheria', post: ' toxin', out: 'diphtheria',
      rule: 'No fixed shape and no complete name. One distinctive word, six letters or more, never a gene symbol.' },
  ];
  specs.forEach((sp, i) => {
    const y = 2.25 + i * 1.25;
    s.addShape('ellipse', { x: 0.6, y: y + 0.06, w: 0.46, h: 0.46, fill: { color: C.blue }, line: { type: 'none' } });
    s.addText(sp.n, { x: 0.6, y: y + 0.06, w: 0.46, h: 0.46, margin: 0, fontFace: TITLE_FONT,
      fontSize: 15, bold: true, color: C.paper, align: 'center', valign: 'middle' });
    s.addText(sp.label, { x: 1.2, y, w: 2.3, h: 0.32, fontFace: LABEL_FONT, fontSize: 15,
      color: C.navy, valign: 'middle' });
    s.addText(sp.count, { x: 1.2, y: y + 0.34, w: 2.3, h: 0.28, fontFace: BODY_FONT, fontSize: 12,
      color: C.grey });
    s.addShape('roundRect', { x: 3.6, y: y + 0.02, w: 5.5, h: 0.5, rectRadius: 0.06,
      fill: { color: 'F4F6F9' }, line: { type: 'none' } });
    s.addText([
      { text: sp.pre, options: { color: C.grey } },
      { text: sp.hit, options: { color: C.navy, bold: true } },
      { text: sp.post, options: { color: C.grey } },
    ], { x: 3.75, y: y + 0.02, w: 5.2, h: 0.5, fontFace: BODY_FONT, fontSize: 12, valign: 'middle', lineSpacing: 15 });
    arrow(s, 9.2, y + 0.27, 9.6, y + 0.27);
    pill(s, { x: 9.7, y: y + 0.05, w: 3.0, h: 0.44, text: sp.out, fill: GREEN30, color: GREEN });
    s.addText(sp.rule, { x: 3.6, y: y + 0.58, w: 9.1, h: 0.32, fontFace: BODY_FONT, fontSize: 12,
      color: C.grey });
    if (i < 2) s.addShape('line', { x: 0.6, y: y + 1.08, w: 12.1, h: 0, line: { color: 'E4E9F0', width: 1 } });
  });
  s.addShape('roundRect', { x: 0.6, y: 5.85, w: 12.1, h: 0.8, rectRadius: 0.08,
    fill: { color: C.navy }, line: { type: 'none' } });
  pill(s, { x: 0.9, y: 6.07, w: 1.35, h: 0.36, text: 'Refused', fill: C.blue, color: C.paper, font: LABEL_FONT });
  pill(s, { x: 2.5, y: 6.03, w: 4.3, h: 0.44, text: 'NOTCH1 HD Domain Mutants', fill: C.paper, color: C.ink });
  s.addText('HD is a protein domain here, not Huntington disease. Read acronyms anywhere and 61 wrong links arrive for every 10 right ones.', {
    x: 7.0, y: 5.85, w: 5.4, h: 0.8, fontFace: BODY_FONT, fontSize: 12, color: C.blue30,
    valign: 'middle', lineSpacing: 16 });
  addLogo(s, 'light');
})();

// ---------------------------------------------------------------- Judge
// The rejects grouped by the kind of mistake rather than by extractor tier: the
// tiers are already on the bar, and a card saying "not judged" only repeats it.
// All three groups are rejects, so no per-card verdict pill is needed.
(() => {
  const s = content('The judge only reads the doubtful links', 'LLM judge');
  subline(s, 'Doubtful is a rule, not a feeling: every single-word link, plus complete-name links scoring under 12.0.', { y: 1.66, h: 0.3 });
  s.addText([
    { text: '351 pathway-disease links, judged by ', options: { color: C.grey } },
    { text: 'Claude Sonnet 5', options: { color: C.navy, bold: true } },
  ], { x: 0.6, y: 2.0, w: 6.5, h: 0.28, fontFace: BODY_FONT, fontSize: 12 });

  // Proportional bar over all 351 links.
  const bx = 0.6, bw = 12.1, by = 2.38, bh = 0.72, total = 351;
  const seg = [
    { n: 200, fill: 'D5DAE2', color: C.grey, top: 'not sent',
      bottom: '85 fixed pattern, plus 115 complete name scoring 12.0 or more' },
    { n: 140, fill: GREEN30, color: GREEN, top: 'kept', bottom: 'judged and confirmed' },
    { n: 11, fill: C.red30, color: RED_TEXT, top: 'rejected', bottom: '7% of the judged tier' },
  ];
  let cx = bx;
  seg.forEach((g) => {
    const w = bw * g.n / total;
    s.addShape('roundRect', { x: cx, y: by, w, h: bh, rectRadius: 0.06,
      fill: { color: g.fill }, line: { type: 'none' } });
    if (w > 1.0) {
      s.addText(`${g.n}  ${g.top}`, { x: cx, y: by, w, h: bh, margin: 0, fontFace: LABEL_FONT,
        fontSize: 14, color: g.color, align: 'center', valign: 'middle' });
      s.addText(g.bottom, { x: cx, y: by + bh + 0.06, w, h: 0.28, fontFace: BODY_FONT,
        fontSize: 12, color: C.grey, align: 'center' });
    } else {
      s.addText(`${g.n} ${g.top}`, { x: cx - 1.5, y: by - 0.42, w: w + 1.5, h: 0.3, margin: 0,
        fontFace: LABEL_FONT, fontSize: 12, color: g.color, align: 'right' });
      s.addText(g.bottom, { x: cx - 2.2, y: by + bh + 0.06, w: w + 2.2, h: 0.28, fontFace: BODY_FONT,
        fontSize: 12, color: C.grey, align: 'right' });
    }
    cx += w;
  });

  s.addText('Every reject is a word sense the string matcher could not see. Three patterns cover 10 of the 11.', {
    x: 0.6, y: 3.6, w: 12.1, h: 0.28, fontFace: LABEL_FONT, fontSize: 13, color: C.navy });

  const cw = 3.83, gap = 0.42, cy = 3.95, ch = 2.5;
  const cases = [
    { head: 'A different disease', rate: '6 of the 11 rejects',
      label: 'SARS-CoV-2 Infection', to: 'severe acute respiratory syndrome',
      why: 'SARS-CoV-2 causes COVID-19, not SARS' },
    { head: 'A protein, not a condition', rate: '2 of the 11 rejects',
      label: 'Regulation of gene expression by Hypoxia-inducible Factor', to: 'hypoxia',
      why: 'part of the protein name, not the state' },
    { head: 'Another sense of the word', rate: '2 of the 11 rejects',
      label: 'NTRK3 as a dependence receptor', to: 'substance dependence',
      why: 'a dependence receptor is a molecular class' },
  ];
  cases.forEach((c, i) => {
    const x = 0.6 + i * (cw + gap);
    card(s, { x, y: cy, w: cw, h: ch });
    s.addText(c.head, { x: x + 0.3, y: cy + 0.2, w: cw - 0.6, h: 0.32, fontFace: LABEL_FONT,
      fontSize: 15, color: C.navy, valign: 'middle' });
    s.addText(c.rate, { x: x + 0.3, y: cy + 0.54, w: cw - 0.6, h: 0.26, fontFace: BODY_FONT,
      fontSize: 12, color: C.grey });
    pill(s, { x: x + 0.3, y: cy + 0.88, w: cw - 0.6, h: 0.5, text: c.label, fill: C.paper, color: C.ink });
    arrow(s, x + cw / 2, cy + 1.42, x + cw / 2, cy + 1.58);
    pill(s, { x: x + 0.3, y: cy + 1.6, w: cw - 0.6, h: 0.44, text: c.to, fill: C.red30, color: RED_TEXT });
    s.addText(c.why, { x: x + 0.3, y: cy + 2.08, w: cw - 0.6, h: 0.32, fontFace: BODY_FONT,
      fontSize: 12, color: C.grey, align: 'center' });
  });
  addLogo(s, 'light');
})();

// ---------------------------------------------------------------- Results
// One headline number carrying the slide, with the benchmark beside it. Three
// equal tiles gave three numbers of very unequal weight the same emphasis.
(() => {
  const s = content('What the pipeline adds to Reactome curation', 'Results');
  const cy = 1.85, ch = 3.5;

  card(s, { x: 0.6, y: cy, w: 4.4, h: ch });
  s.addText('253', { x: 0.6, y: cy + 0.15, w: 4.4, h: 1.6, fontFace: TITLE_FONT, fontSize: 80,
    bold: true, color: C.navy, align: 'center', valign: 'middle' });
  s.addText('new pathway-disease links', { x: 0.8, y: cy + 1.78, w: 4.0, h: 0.35,
    fontFace: LABEL_FONT, fontSize: 14, color: C.grey, align: 'center' });
  s.addShape('line', { x: 0.95, y: cy + 2.2, w: 3.7, h: 0, line: { color: 'D9DEE6', width: 1 } });
  [['177', 'diseases covered', 0.75], ['+947', 'target-disease pairs', 2.75]].forEach(([n, cap, dx]) => {
    s.addText(n, { x: dx, y: cy + 2.34, w: 1.9, h: 0.5, fontFace: TITLE_FONT, fontSize: 26,
      bold: true, color: C.navy, align: 'center', valign: 'middle' });
    s.addText(cap, { x: dx, y: cy + 2.86, w: 1.9, h: 0.3, fontFace: BODY_FONT, fontSize: 12,
      color: C.grey, align: 'center' });
  });

  card(s, { x: 5.3, y: cy, w: 7.4, h: ch });
  pill(s, { x: 5.6, y: cy + 0.22, w: 1.75, h: 0.32, text: 'Benchmark stage', fill: C.blue30, fontSize: 12 });
  s.addText('121 of 653', { x: 5.6, y: cy + 0.66, w: 3.2, h: 0.7, fontFace: TITLE_FONT, fontSize: 34,
    bold: true, color: C.blue, valign: 'middle' });
  s.addText('curated links recovered (18.5%)', { x: 5.6, y: cy + 1.36, w: 4.0, h: 0.32,
    fontFace: BODY_FONT, fontSize: 12, color: C.grey });
  bullets(s, [
    '87 exact, 28 more specific than the curated term, 6 more general',
    'The benchmark is not a ceiling: most curated links name no disease in the label at all',
    'Curators work from pathway biology, the pipeline works from label text',
  ], { x: 5.6, y: cy + 1.8, w: 6.8, h: 1.5, fontSize: 13 });

  s.addText('444 of the 947 come from four large pathways: SARS therapeutics (154 genes), MLL4/MLL3 (134), SARS-CoV-2 immune modulation (125), TPR (64).', {
    x: 0.6, y: 5.5, w: 12.1, h: 0.3, fontFace: BODY_FONT, fontSize: 12, color: C.grey });

  s.addShape('roundRect', { x: 0.6, y: 5.9, w: 12.1, h: 0.8, rectRadius: 0.08,
    fill: { color: C.navy }, line: { type: 'none' } });
  pill(s, { x: 0.9, y: 6.12, w: 1.35, h: 0.36, text: 'Verdict', fill: C.blue, color: C.paper, font: LABEL_FONT });
  s.addText('Merge, do not replace. The pipeline reaches what labels name, curation reaches what biology implies.', {
    x: 2.45, y: 5.9, w: 9.9, h: 0.8, fontFace: LABEL_FONT, fontSize: 15, bold: true,
    color: C.paper, valign: 'middle' });
  addLogo(s, 'light');
})();

// ---------------------------------------------------------------- Non-recovery + bonus
// 453 + 79 = 532, so it is a proportion, not three categories. The acronym
// refusal moved to the extractor slide's takeaway, where it belongs.
(() => {
  const s = content('Why 532 curated links are not recovered', 'Measured, not guessed');
  subline(s, 'Two reasons, both counted against the 653 curated links rather than estimated.', { y: 1.68, h: 0.3 });

  const bx = 0.6, bw = 12.1, by = 2.42, bh = 0.78, TOT = 532;
  const w1 = bw * 453 / TOT;
  s.addText('The label names no disease', { x: bx, y: 2.1, w: 4.0, h: 0.28, fontFace: LABEL_FONT,
    fontSize: 12, color: C.grey });
  s.addText('We name a different disease', { x: 9.9, y: 2.1, w: 2.8, h: 0.28, fontFace: LABEL_FONT,
    fontSize: 12, color: C.navy, align: 'right' });
  s.addShape('roundRect', { x: bx, y: by, w: w1, h: bh, rectRadius: 0.06,
    fill: { color: 'DDE2EA' }, line: { type: 'none' } });
  s.addText('453', { x: bx, y: by, w: w1, h: bh, margin: 0, fontFace: TITLE_FONT, fontSize: 20,
    bold: true, color: C.grey, align: 'center', valign: 'middle' });
  s.addShape('roundRect', { x: bx + w1, y: by, w: bw - w1, h: bh, rectRadius: 0.06,
    fill: { color: C.blue30 }, line: { type: 'none' } });
  s.addText('79', { x: bx + w1, y: by, w: bw - w1, h: bh, margin: 0, fontFace: TITLE_FONT,
    fontSize: 20, bold: true, color: C.navy, align: 'center', valign: 'middle' });

  const py = 3.45, ph = 2.42, cw2 = 6.0, pad = 0.3;
  const shell = (x, head, tag, tagFill, tagColor, items) => {
    card(s, { x, y: py, w: cw2, h: ph });
    s.addText(head, { x: x + pad, y: py + 0.18, w: 4.0, h: 0.3, fontFace: LABEL_FONT,
      fontSize: 15, color: C.navy, valign: 'middle' });
    pill(s, { x: x + cw2 - pad - 0.9, y: py + 0.2, w: 0.9, h: 0.3, text: tag,
      fill: tagFill, color: tagColor, font: LABEL_FONT });
    s.addText(items.map((t) => ({ text: t, options: { breakLine: true, bullet: true } })), {
      x: x + 0.32, y: py + 0.54, w: 5.4, h: 0.5, fontFace: BODY_FONT, fontSize: 12,
      color: C.ink, valign: 'top', lineSpacing: 17, bullet: { code: '2022', indent: 14 } });
  };
  const micro = (x, y, w, t, col) => s.addText(t, { x, y, w, h: 0.22, fontFace: BODY_FONT,
    fontSize: 12, color: col || C.grey, align: 'center' });

  // Left: the label carries no disease, so there was nothing for us to read.
  shell(0.6, 'Out of scope, not a miss', '453', 'DDE2EA', C.grey,
    ['The label is pure biology, with no disease in the text',
     'The disease comes from gene knowledge, not from words']);
  micro(0.9, py + 1.06, 5.4, 'pathway label');
  pill(s, { x: 0.9, y: py + 1.28, w: 5.4, h: 0.36, text: 'Signaling by plasma membrane FGFR1 fusions', fill: 'FFFFFF', color: C.ink });
  arrow(s, 3.6, py + 1.68, 3.6, py + 1.82);
  micro(0.9, py + 1.84, 5.4, 'curated disease');
  pill(s, { x: 0.9, y: py + 2.06, w: 5.4, h: 0.36, text: 'cancer', fill: 'DDE2EA', color: C.grey });

  // Right: the label names the disease outright and curation recorded a parent.
  shell(6.7, 'Disagreement, worth reviewing', '79', C.blue30, C.navy,
    ['Ours sits deeper in the ontology in 82% of them',
     'Unrelated in the ontology, but usually the sharper term']);
  micro(7.0, py + 1.06, 5.4, 'pathway label');
  pill(s, { x: 7.0, y: py + 1.28, w: 5.4, h: 0.36, text: 'Defective HLCS causes multiple carboxylase deficiency', fill: 'FFFFFF', color: C.ink });
  arrow(s, 9.7, py + 1.68, 9.7, py + 1.82);
  micro(7.0, py + 1.84, 2.65, 'curated disease');
  micro(9.75, py + 1.84, 2.65, 'what we read', C.navy);
  pill(s, { x: 7.0, y: py + 2.06, w: 2.65, h: 0.36, text: 'inborn vitamin metabolic disorder', fill: 'DDE2EA', color: C.grey });
  pill(s, { x: 9.75, y: py + 2.06, w: 2.65, h: 0.36, text: 'multiple carboxylase deficiency', fill: C.blue30, color: C.navy });

  s.addShape('roundRect', { x: 0.6, y: 6.0, w: 12.1, h: 0.72, rectRadius: 0.08,
    fill: { color: C.navy }, line: { type: 'none' } });
  pill(s, { x: 0.9, y: 6.18, w: 1.9, h: 0.36, text: 'Read first', fill: C.blue, color: C.paper, font: LABEL_FONT });
  s.addText('The other 14 are not sharper: our term is broader, or an acronym in the slot resolved to the wrong disease. Seven of those 14 are acronym cases.', {
    x: 3.0, y: 6.0, w: 9.4, h: 0.72, fontFace: LABEL_FONT, fontSize: 14, bold: true,
    color: C.paper, valign: 'middle' });
  addLogo(s, 'light');
})();

// ================================================================ PART 2
divider('Part 2', 'The same pipeline, other sources');

// ---------------------------------------------------------------- Next library
(() => {
  const s = content('The next library along the street', 'Gene Ontology');
  subline(s, 'Reactome is read. The same extractors and the same judge now walk into the next one, with nothing rewritten.',
    { y: 1.68, h: 0.3 });
  skyline(s, { Reactome: 'done', GO: 'now' });
  s.addShape('roundRect', { x: 0.6, y: 5.6, w: 12.1, h: 0.8, rectRadius: 0.08,
    fill: { color: C.navy }, line: { type: 'none' } });
  pill(s, { x: 0.9, y: 5.82, w: 1.6, h: 0.36, text: 'Third gap', fill: C.blue, color: C.paper, font: LABEL_FONT });
  s.addText('Open Targets curates one of these buildings. The pipeline can read any of them.', {
    x: 2.7, y: 5.6, w: 9.7, h: 0.8, fontFace: LABEL_FONT, fontSize: 16, bold: true,
    color: C.paper, valign: 'middle' });
  addLogo(s, 'light');
})();

// ---------------------------------------------------------------- GO
(() => {
  const s = content('GO runs through the same code, two steps off', 'Gene Ontology biological processes', { fontSize: 34 });
  subline(s, 'Same extractors, same judge, same thresholds. Only the Reactome-specific layers are switched off.', { y: 1.72, h: 0.35 });

  const cw = 3.83, gap = 0.42, cy = 2.15, ch = 3.4;
  const cards = [
    { count: '165', label: 'Over 16 diseases',
      tag: 'links matched', tagFill: C.blue30, tagColor: C.navy,
      items: ['24,136 non-obsolete labels scanned', 'Judge: 141 kept, 24 rejected'],
      ex: ['type III hypersensitivity', 'IgE responsiveness, atopic', 'green'] },
    { count: '0', label: 'Two Reactome layers off',
      tag: 'fixed pattern', tagFill: 'E8EBF0', tagColor: C.grey,
      items: ['No "Defective GENE causes" labels', 'No GO-disease evidence, no benchmark', 'Genes from target.go, not pathways'],
      ex: ['Benchmark stage', 'no baseline, every link is a candidate', 'grey'] },
    { count: '0.3%', label: 'Processes, not disease pathways',
      tag: 'disease cue', tagFill: C.red30, tagColor: RED_TEXT,
      items: ['Links cluster on inflammation and hypoxia', 'Judge rejects 31%, against 7% on Reactome'],
      ex: ['reactive gliosis', 'Gliosis', 'green'] },
  ];
  cards.forEach((r, i) => {
    const x = 0.6 + i * (cw + gap);
    card(s, { x, y: cy, w: cw, h: ch });
    s.addText(r.count, { x: x + 0.3, y: cy + 0.15, w: 1.9, h: 0.6, fontFace: TITLE_FONT,
      fontSize: 30, bold: true, color: C.navy, valign: 'middle' });
    pill(s, { x: x + cw - 0.3 - 1.6, y: cy + 0.27, w: 1.6, h: 0.32, text: r.tag,
      fill: r.tagFill, color: r.tagColor, fontSize: 12 });
    s.addText(r.label, { x: x + 0.3, y: cy + 0.8, w: cw - 0.6, h: 0.35, fontFace: LABEL_FONT,
      fontSize: 15, color: C.navy });
    s.addText(r.items.map((t) => ({ text: t, options: { breakLine: true, bullet: true } })), {
      x: x + 0.32, y: cy + 1.2, w: cw - 0.64, h: 0.95, fontFace: BODY_FONT, fontSize: 12,
      color: C.ink, valign: 'top', lineSpacing: 17, bullet: { code: '2022', indent: 14 } });
    const [from, to, kind] = r.ex;
    const fill = kind === 'green' ? GREEN30 : 'DDE2EA';
    const col = kind === 'green' ? GREEN : C.grey;
    pill(s, { x: x + 0.3, y: cy + 2.25, w: cw - 0.6, h: 0.42, text: from, fill: 'FFFFFF', color: C.ink });
    arrow(s, x + cw / 2, cy + 2.71, x + cw / 2, cy + 2.87);
    pill(s, { x: x + 0.3, y: cy + 2.89, w: cw - 0.6, h: 0.42, text: to, fill, color: col });
  });

  s.addShape('roundRect', { x: 0.6, y: 5.75, w: 12.1, h: 0.85, rectRadius: 0.08,
    fill: { color: C.navy }, line: { type: 'none' } });
  pill(s, { x: 0.9, y: 6.0, w: 1.35, h: 0.36, text: 'Verdict', fill: C.blue, color: C.paper, font: LABEL_FONT });
  s.addText('On GO the judge is essential, not optional. The output is review-first, not curation-ready.', {
    x: 2.45, y: 5.75, w: 9.9, h: 0.85, fontFace: LABEL_FONT, fontSize: 16, bold: true,
    color: C.paper, valign: 'middle' });
  addLogo(s, 'light');
})();

// ---------------------------------------------------------------- Model comparison
(() => {
  const s = content('The judge is the one non-deterministic step', 'Haiku, Sonnet, Opus');
  subline(s, 'Every other stage is string work and arithmetic, identical in every run. Three models were given the same candidates and the same prompt.',
    { y: 1.72, h: 0.35 });
  table(s, {
    x: 0.6, y: 2.2, w: 12.1, fontSize: 12,
    headers: ['Model', 'Reactome rejects', 'False rejects', 'GO rejects', '$ / 1M in', '$ / 1M out'],
    colW: [3.1, 2.2, 1.9, 1.9, 1.5, 1.5],
    keyCol: 0, numCols: [1, 2, 3, 4, 5],
    rows: [
      ['Claude Haiku 4.5', '6', '2', '37', '1.00', '5.00'],
      ['Claude Sonnet 5 (default)', '11', '1', '24', '3.00', '15.00'],
      ['Claude Opus 4.8', '8', '1', '21', '5.00', '25.00'],
    ],
  });

  const cw = 3.83, gap = 0.42, cy = 4.45, ch = 1.35;
  const notes = [
    { label: 'Where they agree', items: ['Reactome: 137 of 151 (91%)', 'GO: 60 of 77 (78%)'] },
    { label: 'Where they split', items: ['The "sars" alias, hypoxia as process or disease', 'GO: Haiku strictest, rejecting on tissue'] },
    { label: 'Safeguard', items: ['False-reject check against curated evidence', 'Human review of every candidate'] },
  ];
  notes.forEach((nt, i) => {
    const x = 0.6 + i * (cw + gap);
    card(s, { x, y: cy, w: cw, h: ch });
    s.addText(nt.label, { x: x + 0.3, y: cy + 0.18, w: cw - 0.6, h: 0.32, fontFace: LABEL_FONT,
      fontSize: 15, color: C.navy, valign: 'middle' });
    s.addText(nt.items.map((t) => ({ text: t, options: { breakLine: true, bullet: true } })), {
      x: x + 0.32, y: cy + 0.56, w: cw - 0.64, h: 0.72, fontFace: BODY_FONT, fontSize: 12,
      color: C.ink, valign: 'top', lineSpacing: 17, bullet: { code: '2022', indent: 14 } });
  });

  s.addShape('roundRect', { x: 0.6, y: 6.0, w: 12.1, h: 0.75, rectRadius: 0.08,
    fill: { color: C.navy }, line: { type: 'none' } });
  pill(s, { x: 0.9, y: 6.19, w: 1.35, h: 0.36, text: 'Verdict', fill: C.blue, color: C.paper, font: LABEL_FONT });
  s.addText('The model shifts a handful of borderline calls, not the result. Sonnet 5 is the default.', {
    x: 2.45, y: 6.0, w: 9.9, h: 0.75, fontFace: LABEL_FONT, fontSize: 16, bold: true,
    color: C.paper, valign: 'middle' });
  footer(s, 'Anthropic list prices, USD per 1M tokens. Sonnet 5 has an introductory rate to 2026-08-31.', false, '');
  addLogo(s, 'light');
})();

// ---------------------------------------------------------------- The question
questionSlide('What about other pathway databases?');

// ---------------------------------------------------------------- All libraries
(() => {
  const s = content('All of them, through the same code', 'Enrichr');
  subline(s, 'Reactome and GO come from Open Targets. The rest are public libraries, taken from the Enrichr catalogue.',
    { y: 1.68, h: 0.3 });
  const state = { Reactome: 'done', GO: 'done' };
  LIBRARIES.slice(2).forEach((n) => { state[n] = 'now'; });
  skyline(s, state);
  s.addShape('roundRect', { x: 0.6, y: 5.6, w: 12.1, h: 0.8, rectRadius: 0.08,
    fill: { color: C.navy }, line: { type: 'none' } });
  pill(s, { x: 0.9, y: 5.82, w: 1.6, h: 0.36, text: 'Third gap', fill: C.blue, color: C.paper, font: LABEL_FONT });
  s.addText('Open Targets derives evidence from one of these. The pipeline read every one of them.', {
    x: 2.7, y: 5.6, w: 9.7, h: 0.8, fontFace: LABEL_FONT, fontSize: 16, bold: true,
    color: C.paper, valign: 'middle' });
  addLogo(s, 'light');
})();

// ---------------------------------------------------------------- Enrichr results
(() => {
  const s = content('1,118 pathway-disease links across 12 libraries', 'Enrichr results', { fontSize: 32 });

  const tiles = [
    ['1,118', 'pathway-disease links kept'],
    ['349', 'diseases covered'],
    ['~36,700', 'new target-disease pairs'],
  ];
  const tw = 3.83, tgap = 0.42, ty = 1.72, th = 1.25;
  tiles.forEach(([num, cap], i) => {
    const x = 0.6 + i * (tw + tgap);
    card(s, { x, y: ty, w: tw, h: th });
    s.addText(num, { x, y: ty + 0.06, w: tw, h: 0.72, fontFace: TITLE_FONT, fontSize: 36, bold: true,
      color: C.navy, align: 'center', valign: 'middle' });
    s.addText(cap, { x: x + 0.2, y: ty + 0.8, w: tw - 0.4, h: 0.36, fontFace: BODY_FONT, fontSize: 13,
      color: C.grey, align: 'center', valign: 'top' });
  });

  const cy = 3.15, ch = 2.7;
  s.addChart(pres.ChartType.bar, [{
    name: 'Pathway-disease links kept',
    labels: ['Elsevier', 'WikiPathways', 'BioPlanet', 'KEGG', 'BioCarta', 'Panther', 'NCI-Nature', 'MSigDB Hallmark'],
    values: [737, 179, 91, 88, 13, 5, 3, 2],
  }], {
    x: 0.5, y: cy, w: 7.1, h: ch, barDir: 'bar',
    showTitle: false, showLegend: false, showValue: true, dataLabelPosition: 'outEnd',
    dataLabelColor: C.grey, dataLabelFontFace: BODY_FONT, dataLabelFontSize: 12,
    chartColors: [C.blue],
    catAxisLabelColor: C.grey, catAxisLabelFontFace: BODY_FONT, catAxisLabelFontSize: 12,
    valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    valAxisMaxVal: 850, barGapWidthPct: 60,
  });

  const rx = 7.9, rw = 4.8;
  card(s, { x: rx, y: cy, w: rw, h: ch });
  s.addText('What the yield tells us', { x: rx + 0.3, y: cy + 0.22, w: rw - 0.6, h: 0.32,
    fontFace: LABEL_FONT, fontSize: 15, color: C.navy, valign: 'middle' });
  bullets(s, [
    'Elsevier gives 737 of 1,118: labels read "X in Disease Y"',
    'PFOCR, 21,845 terms, gives zero: labels are figure IDs',
    'HumanCyc and MSigDB modules give zero, correctly',
    '26 of 1,144 rejected (2.3%): Reactome-like, not GO-like',
  ], { x: rx + 0.32, y: cy + 0.62, w: rw - 0.64, h: ch - 0.75, fontSize: 12 });

  s.addShape('roundRect', { x: 0.6, y: 6.05, w: 12.1, h: 0.72, rectRadius: 0.08,
    fill: { color: C.navy }, line: { type: 'none' } });
  pill(s, { x: 0.9, y: 6.23, w: 1.35, h: 0.36, text: 'Verdict', fill: C.blue, color: C.paper, font: LABEL_FONT });
  s.addText('One rule holds across every source: labels that name a disease are high yield, process labels are not.', {
    x: 2.45, y: 6.05, w: 9.9, h: 0.72, fontFace: LABEL_FONT, fontSize: 15, bold: true,
    color: C.paper, valign: 'middle' });
  footer(s, 'Twelve curated Pathways libraries of the 228 in Enrichr, judged with Claude Sonnet 5.', false, '');
  addLogo(s, 'light');
})();

// ---------------------------------------------------------------- All sources
(() => {
  const s = content('Reactome is one fifth of what the pipeline finds', 'All sources compared', { fontSize: 34 });
  subline(s, 'The same extractors and the same judge on every source. Counts below are pathway-disease links the judge kept.',
    { y: 1.68, h: 0.3 });

  // One proportional bar over all 1,599 kept links. Dark segments are the sources
  // Open Targets already ships, light ones are the Enrichr libraries.
  const bx = 0.6, bw = 12.1, by = 2.5, bh = 0.75, total = 1599;
  const seg = [
    { n: 340, name: 'Reactome', fill: C.navy, color: C.paper },
    { n: 141, name: 'GO', fill: C.blue, color: C.paper },
    { n: 737, name: 'Elsevier', fill: C.blue50, color: C.navy },
    { n: 179, name: 'WikiPathways', fill: C.blue30, color: C.navy },
    { n: 202, name: 'six more libraries', fill: 'DDE2EA', color: C.grey },
  ];
  // Provenance brackets over the bar: two groups, labelled and ruled.
  const otW = bw * (340 + 141) / total;
  [{ x: bx, w: otW, t: 'Open Targets sources   481', c: C.navy },
   { x: bx + otW, w: bw - otW, t: 'Enrichr, 12 libraries   1,118', c: C.blue }].forEach((g) => {
    s.addText(g.t, { x: g.x, y: 2.06, w: g.w, h: 0.3, fontFace: LABEL_FONT, fontSize: 12,
      color: g.c, align: 'center', valign: 'middle' });
    s.addShape('rect', { x: g.x + 0.04, y: 2.4, w: g.w - 0.08, h: 0.04,
      fill: { color: g.c }, line: { type: 'none' } });
  });
  let cx = bx;
  seg.forEach((g) => {
    const w = bw * g.n / total;
    s.addShape('roundRect', { x: cx, y: by, w, h: bh, rectRadius: 0.06,
      fill: { color: g.fill }, line: { type: 'none' } });
    s.addText(`${g.n}   ${g.name}`, { x: cx, y: by, w, h: bh, margin: 0, fontFace: LABEL_FONT,
      fontSize: 12, color: g.color, align: 'center', valign: 'middle' });
    s.addText(`${Math.round(100 * g.n / total)}%`, { x: cx, y: by + bh + 0.06, w, h: 0.28,
      fontFace: BODY_FONT, fontSize: 12, color: C.grey, align: 'center' });
    cx += w;
  });

  table(s, {
    x: 0.6, y: 3.85, w: 12.1, fontSize: 12,
    headers: ['Source', 'Labels scanned', 'Links matched', 'Links kept', 'Rejected of judged', 'Diseases'],
    colW: [3.3, 1.9, 1.8, 1.6, 2.0, 1.5],
    keyCol: 0, numCols: [1, 2, 3, 4, 5],
    rows: [
      ['Reactome', '2,870', '351', '340', '11 of 151', '215'],
      ['GO biological process', '24,136', '165', '141', '24 of 77', '16'],
      ['Enrichr, 12 libraries', '28,064', '1,144', '1,118', '26 of 1,144', '349'],
    ],
  });

  s.addShape('roundRect', { x: 0.6, y: 6.05, w: 12.1, h: 0.72, rectRadius: 0.08,
    fill: { color: C.navy }, line: { type: 'none' } });
  pill(s, { x: 0.9, y: 6.23, w: 1.35, h: 0.36, text: 'Verdict', fill: C.blue, color: C.paper, font: LABEL_FONT });
  s.addText('Four fifths of the 1,599 links come from sources Open Targets does not curate today.', {
    x: 2.45, y: 6.05, w: 9.9, h: 0.72, fontFace: LABEL_FONT, fontSize: 15, bold: true,
    color: C.paper, valign: 'middle' });
  footer(s, 'Open Targets Platform release 26.06 and Enrichr pathway libraries, judged with Claude Sonnet 5.', false, '');
  addLogo(s, 'light');
})();

// ---------------------------------------------------------------- Conclusion
(() => {
  const s = pres.addSlide();
  s.background = { color: C.paper };
  contentTitle(s, 'Why this is worth building', { kicker: 'Conclusion' });

  // Left column reserved for the Neuroflux figure: drop the picture inside the
  // panel and the caption below reads as its label.
  const px = 0.6, py = 1.95, pw = 3.5, ph = 3.6;
  card(s, { x: px, y: py, w: pw, h: ph });
  s.addText('Neuroflux', { x: px, y: py + ph + 0.08, w: pw, h: 0.3, fontFace: BODY_FONT,
    fontSize: 12, color: C.grey, align: 'center' });

  // Three benefits, not five. What it produces, that it generalises, and that
  // someone was already blocked without it. Cost lives in the verdict strip.
  const rows = [
    ['Scale', '253 new pathway-disease links, +947 target-disease pairs and 44 specificity fixes, from Reactome alone'],
    ['Works on any source', 'GO: 141 links. Enrichr, 12 libraries: 1,118 links. A new resource needs no method change'],
    ['Demonstrated need', 'Neuroflux and Neuroid, two Open Targets projects where disease-pathway coverage was the limit'],
  ];
  const rx = 4.4, y0 = 2.25, step = 1.16;
  rows.forEach(([head, body], i) => {
    const y = y0 + i * step;
    s.addShape('ellipse', { x: rx, y: y + 0.04, w: 0.52, h: 0.52, fill: { color: C.blue }, line: { type: 'none' } });
    s.addText(String(i + 1), { x: rx, y: y + 0.04, w: 0.52, h: 0.52, margin: 0, fontFace: TITLE_FONT,
      fontSize: 17, bold: true, color: C.paper, align: 'center', valign: 'middle' });
    s.addText(head, { x: rx + 0.7, y: y + 0.02, w: 3.0, h: 0.4, fontFace: LABEL_FONT, fontSize: 18,
      color: C.navy, valign: 'middle' });
    s.addText(body, { x: rx + 0.7, y: y + 0.46, w: 7.6, h: 0.5, fontFace: BODY_FONT, fontSize: 14,
      color: C.ink, valign: 'top', lineSpacing: 19 });
    if (i < rows.length - 1) {
      s.addShape('line', { x: rx + 0.7, y: y + 1.0, w: 12.7 - rx - 0.7, h: 0, line: { color: 'E4E9F0', width: 1 } });
    }
  });

  s.addShape('roundRect', { x: 0.6, y: 6.0, w: 12.1, h: 0.75, rectRadius: 0.08,
    fill: { color: C.navy }, line: { type: 'none' } });
  pill(s, { x: 0.9, y: 6.19, w: 1.35, h: 0.36, text: 'Verdict', fill: C.blue, color: C.paper, font: LABEL_FONT });
  s.addText('No new experiments and no new curation. One method, and it fits every source.', {
    x: 2.45, y: 6.0, w: 9.9, h: 0.75, fontFace: LABEL_FONT, fontSize: 16, bold: true,
    color: C.paper, valign: 'middle' });
  addLogo(s, 'light');
})();

// ---------------------------------------------------------------- Thank you
// The slide 3 library again, but the shelves have been read: every slot the
// dragon books came from is empty, they are stacked by the chair, and the
// curator is sitting down. Native shapes, same seeded shelving.
(() => {
  const s = pres.addSlide();
  s.background = { color: C.paper };

  const ROWS = 4, PITCH = 1.5667, FIRST = 1.90;
  const BAY = 6.0, TEXT_X = 7.2, PLANK = 'B9BEC6';
  const plankOf = (r) => FIRST + r * PITCH;
  const floor = plankOf(ROWS - 1);
  // the slots the dragon books used to stand in, now empty
  const EMPTY = [[1, 3.05], [1, 4.55], [1, 5.25], [2, 2.75], [2, 3.40],
    [2, 4.90], [3, 3.15], [3, 4.25]];
  const blocked = (r) => EMPTY.filter((g) => g[0] === r).map((g) => [g[1], g[1] + 0.5]);

  let seed = 20260827;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const NEAR = ['D5DAE2', 'DDE2EA', 'CBD2DC', 'E1E5EB'];
  const MID = ['E1E5EB', 'E7EAEF', 'DDE2EA'];
  const FAR = ['F0F2F5', 'F4F6F8', 'EDEFF3'];

  for (let r = 0; r < ROWS; r += 1) {
    const plankY = plankOf(r), stop = blocked(r);
    s.addShape('rect', { x: 0, y: plankY, w: BAY, h: 0.06, fill: { color: C.navy }, line: { type: 'none' } });
    s.addShape('rect', { x: BAY, y: plankY, w: TEXT_X - BAY, h: 0.06, fill: { color: PLANK }, line: { type: 'none' } });
    s.addShape('rect', { x: TEXT_X, y: plankY, w: T.W - TEXT_X, h: 0.06, fill: { color: 'E6E9ED' }, line: { type: 'none' } });
    let x = 0.08;
    while (x < 13.2) {
      const bw = 0.15 + rnd() * 0.15, bh = 0.85 + rnd() * 0.62;
      const hit = stop.find(([a, b]) => x < b && x + bw > a);
      if (hit) { x = hit[1] + 0.03; continue; }
      const tone = r === 0 ? pick(FAR) : x < BAY ? pick(NEAR) : x < TEXT_X ? pick(MID) : pick(FAR);
      s.addShape('rect', { x, y: plankY - bh, w: bw, h: bh, fill: { color: tone }, line: { type: 'none' } });
      x += bw + 0.02 + rnd() * 0.03;
    }
  }
  s.addShape('rect', { x: BAY, y: FIRST, w: 0.07, h: floor - FIRST + 0.06, fill: { color: C.navy }, line: { type: 'none' } });

  // The armchair, and the curator sitting in it with a book open.
  // Chair in grey, person in navy, so the silhouette separates from the furniture.
  const navy = { color: C.navy }, wood = { color: 'ACAFAF' };
  const put = (x, y, w, h, rr, fill) => s.addShape(rr ? 'roundRect' : 'rect', {
    x, y, w, h, ...(rr ? { rectRadius: rr } : {}), fill: fill || navy, line: { type: 'none' } });
  const seatY = floor - 0.85;
  put(2.18, floor - 2.30, 0.30, 1.45, 0.1, wood);     // chair back
  put(2.48, seatY, 1.50, 0.26, 0.08, wood);           // seat
  put(2.56, seatY + 0.26, 0.13, 0.59, 0, wood);       // chair legs
  put(3.80, seatY + 0.26, 0.13, 0.59, 0, wood);
  put(2.50, floor - 2.05, 0.44, 1.20, 0.15);          // torso, back to the chair
  s.addShape('ellipse', { x: 2.47, y: floor - 2.56, w: 0.50, h: 0.50, fill: navy, line: { type: 'none' } });
  put(2.94, seatY - 0.24, 0.86, 0.24, 0.1);           // thigh along the seat
  put(3.60, seatY, 0.24, 0.85, 0.1);                  // shin, in front of the chair leg
  put(3.60, floor - 0.13, 0.46, 0.13, 0.06);          // foot
  put(2.90, floor - 1.76, 0.54, 0.15, 0.07);          // forearm out to the book
  put(3.36, floor - 1.99, 0.62, 0.44, 0.04, { color: C.blue });   // the book being read

  // Every dragon book, gathered in one pile beside the chair.
  const runs = (t) => t.split(/(Dragon)/).filter(Boolean)
    .map((part) => ({ text: part, options: { bold: part === 'Dragon' } }));
  const PILE = ['Dragons of Autumn Twilight', 'The Girl with the Dragon Tattoo',
    'How to Train Your Dragon', 'A Dance with Dragons', 'The Flight of Dragons',
    'The Last Dragon', 'Dragon Rider', 'Red Dragon'];
  const JIT = [0, 0.07, -0.05, 0.03, -0.07, 0.02, 0.06, -0.03];
  PILE.forEach((t, i) => {
    const x = 5.25 + JIT[i], y = floor - 0.32 - i * 0.33;
    s.addShape('rect', { x, y, w: 3.0, h: 0.31, fill: { color: C.blue }, line: { type: 'none' } });
    s.addText(runs(t), { x: x + 0.05, y, w: 2.9, h: 0.31, margin: 0, fontFace: BODY_FONT,
      fontSize: 12, color: C.paper, align: 'center', valign: 'middle' });
  });

  contentTitle(s, 'Thank you', { fontSize: 54 });
  addLogo(s, 'light');
})();

// ---------------------------------------------------------------- Backup: acronyms
// Counts are distinct diseases carrying each lowercase form, from
// disease_chunks.csv. The top six make the case on their own: half of them are
// ordinary English words or two letters.
(() => {
  const s = content('Why acronyms are refused', 'Backup: matcher detail');
  subline(s, 'Everything the matcher searches for sits on one list of strings. An acronym is kept off that list, and these are the two ways one gets back on.',
    { y: 1.68, h: 0.3 });

  s.addText('4,426 acronyms in the index. 802 name more than one disease.', {
    x: 0.6, y: 2.06, w: 5.7, h: 0.28, fontFace: LABEL_FONT, fontSize: 12, color: C.navy });
  table(s, {
    x: 0.6, y: 2.35, w: 5.7, fontSize: 12,
    headers: ['Acronym', 'Disease terms it names'],
    colW: [1.9, 3.8], keyCol: 0, barCol: 1,
    rows: [['HAND', '101'], ['AML', '72'], ['CDG', '58'], ['FACE', '54'], ['GSD', '49'], ['AS', '36']],
  });

  const R = 6.9, rw = 5.8, cy = 2.06, ch = 3.86, iw = rw - 0.6;
  card(s, { x: R, y: cy, w: rw, h: ch });
  s.addText('Where an acronym is still allowed', { x: R + 0.3, y: cy + 0.22, w: iw, h: 0.34,
    fontFace: LABEL_FONT, fontSize: 16, color: C.navy });

  // Each row names the list, the verdict, and where the permission comes from.
  const row = (y, name, verdict, vFill, vColor, source, detail) => {
    s.addText(name, { x: R + 0.3, y, w: 3.4, h: 0.3, fontFace: LABEL_FONT, fontSize: 14,
      color: C.navy, valign: 'middle' });
    pill(s, { x: R + rw - 0.3 - 1.5, y: y - 0.02, w: 1.5, h: 0.32, text: verdict,
      fill: vFill, color: vColor, font: LABEL_FONT });
    if (source) {
      s.addShape('rect', { x: R + 0.3, y: y + 0.42, w: 0.2, h: 0.08, fill: { color: C.blue }, line: { type: 'none' } });
      s.addText(source.toUpperCase(), { x: R + 0.58, y: y + 0.34, w: iw - 0.28, h: 0.26,
        fontFace: LABEL_FONT, fontSize: 12, color: C.blue, charSpacing: 1 });
    }
    s.addText(detail, { x: R + 0.3, y: y + (source ? 0.62 : 0.32), w: iw, h: 0.5,
      fontFace: BODY_FONT, fontSize: 12, color: C.ink, valign: 'top', lineSpacing: 16 });
  };

  row(cy + 0.75, 'Complete-name list', 'never', C.red30, RED_TEXT, null,
    'An acronym is not a spelled-out name, so it never reaches this list. No exception exists.');
  row(cy + 1.62, 'Single-word list', 'four only', C.blue30, C.navy, 'source: human review',
    'HIV, SARS, HSE and MSUD, each mapped by hand to one disease. Nothing joins automatically.');
  row(cy + 2.72, 'Template slot', 'always', GREEN30, GREEN, 'source: the label itself',
    'Defective ABCC6 causes PXE. The sentence proves the slot holds a disease before the acronym is read.');

  s.addShape('roundRect', { x: 0.6, y: 6.08, w: 12.1, h: 0.66, rectRadius: 0.08,
    fill: { color: C.navy }, line: { type: 'none' } });
  pill(s, { x: 0.9, y: 6.23, w: 1.6, h: 0.36, text: 'Measured', fill: C.blue, color: C.paper, font: LABEL_FONT });
  s.addText('Searching acronyms freely was tested: 10 more correct links, 61 wrong ones. It stays off.', {
    x: 2.7, y: 6.08, w: 9.7, h: 0.66, fontFace: LABEL_FONT, fontSize: 14, bold: true,
    color: C.paper, valign: 'middle' });
  addLogo(s, 'light');
})();

// ---------------------------------------------------------------- Backup: acronym pile
// Split over two slides so no pathway label is truncated: the disease sits at
// the end of a "Defective GENE causes DISEASE" label, so cutting the tail would
// remove the one part a reviewer needs.
const ACRONYM_PILE = [
  ['AEXS', 'Defective CYP19A1 causes AEXS', 'aromatase excess syndrome', 'pseudohermaphroditism'],
  ['CDG-1I', 'Defective ALG2 causes CDG-1i', 'ALG2-congenital disorder of glycosylation', 'Congenital myasthenic syndromes'],
  ['CMS', 'Defective ALG14 causes ALG14-CMS', 'congenital myasthenic syndrome', 'Congenital myasthenic syndromes'],
  ['DRTA', 'Defective SLC4A1 causes hereditary spherocytosis type 4 (HSP4), distal renal tubular acidosis (dRTA) and dRTA with hemolytic anemia', 'distal renal tubular acidosis', 'non-autoimmune hemolytic anemia'],
  ['FFDD4', 'Defective CYP26C1 causes FFDD4', 'focal facial dermal dysplasia type IV', 'skin neoplasm'],
  ['HFE4', 'Defective SLC40A1 causes hemochromatosis 4 (HFE4) (duodenum)', 'hemochromatosis type 4', 'infantile epileptic encephalopathy'],
  ['HFE4', 'Defective SLC40A1 causes hemochromatosis 4 (HFE4) (macrophages)', 'hemochromatosis type 4', 'infantile epileptic encephalopathy'],
  ['IFD', 'Defective CBLIF causes IFD', 'Congenital intrinsic factor deficiency', 'Grasbeck-Imerslund disease'],
  ['IFD', 'Defective CBLIF causes IFD', 'hereditary intrinsic factor deficiency', 'Grasbeck-Imerslund disease'],
  ['MGA1', 'Defective AMN causes MGA1', '3-methylglutaconic aciduria type 1', 'Grasbeck-Imerslund disease'],
  ['MGA1', 'Defective CUBN causes MGA1', '3-methylglutaconic aciduria type 1', 'Grasbeck-Imerslund disease'],
  ['OI', 'Defective SLC6A2 causes orthostatic intolerance (OI)', 'osteogenesis imperfecta', 'Sensorineural hearing impairment'],
  ['PPS', 'Defective B3GALTL causes PpS', 'popliteal pterygium syndrome', 'Peters plus syndrome, orofacial cleft'],
  ['SPG42', 'Defective SLC33A1 causes spastic paraplegia 42 (SPG42)', 'Autosomal dominant spastic paraplegia type 42', 'cataract, hemochromatosis'],
  ['SPG42', 'Defective SLC33A1 causes spastic paraplegia 42 (SPG42)', 'hereditary spastic paraplegia 42', 'cataract, hemochromatosis'],
];

[[0, 8, 'one of two'], [8, 15, 'two of two']].forEach(([from, to, part]) => {
  const s = content('Every acronym disagreement', `Backup: the review pile, ${part}`);
  subline(s, 'Every disagreement whose disease came from an acronym sitting in a template slot. Fifteen rows in total, and the pile to read first.',
    { y: 1.66, h: 0.3 });
  table(s, {
    x: 0.6, y: 2.05, w: 12.1, fontSize: 12,
    headers: ['Acronym', 'Pathway label', 'Disease we read', 'Curated disease'],
    colW: [0.9, 5.4, 3.1, 2.7], keyCol: 0,
    rows: ACRONYM_PILE.slice(from, to),
  });
  footer(s, 'Reactome, release 26.06. Fifteen of the 79 disagreements, all from the one place acronyms are licensed.', false, '');
  addLogo(s, 'light');
});

// ---------------------------------------------------------------- Backup: libraries
(() => {
  const s = content('Twelve more public pathway libraries', 'Backup: how the libraries were chosen');

  // How the 12 were selected, as a funnel rather than a sentence.
  const fy = 1.72, fh = 0.44;
  const steps = [
    { w: 2.5, text: '228 Enrichr libraries', fill: C.navy, color: C.paper, font: LABEL_FONT },
    { w: 2.9, text: 'curated Pathways category', fill: C.blue30, color: C.navy },
    { w: 4.0, text: 'latest version, no Reactome, GO or mouse', fill: C.blue30, color: C.navy },
    { w: 1.6, text: '12 libraries', fill: C.blue, color: C.paper, font: LABEL_FONT },
  ];
  let fx = 0.6;
  steps.forEach((st, i) => {
    pill(s, { x: fx, y: fy, w: st.w, h: fh, text: st.text, fill: st.fill, color: st.color, font: st.font });
    fx += st.w;
    if (i < steps.length - 1) { arrow(s, fx, fy + fh / 2, fx + 0.33, fy + fh / 2); fx += 0.33; }
  });
  s.addText('Labels and gene sets ship in one GMT file, so gene membership needs no target-to-pathway join.', {
    x: 0.6, y: 2.26, w: 12.1, h: 0.3, fontFace: BODY_FONT, fontSize: 12, color: C.grey });

  table(s, {
    x: 0.6, y: 2.62, w: 12.1, fontSize: 12,
    headers: ['Library', 'What it is', 'Labels name'],
    colW: [3.5, 6.7, 1.9], keyCol: 0, pillCol: 2,
    rows: [
      ['Elsevier_Pathway_Collection', 'commercially curated disease-mechanism pathways', 'diseases'],
      ['KEGG_2026', 'metabolic, signalling and human-disease pathways', 'pathways'],
      ['WikiPathways_2024_Human', 'community-curated biological pathways', 'pathways'],
      ['BioPlanet_2019', 'NCATS, integrated and deduplicated human pathways', 'pathways'],
      ['BioCarta / NCI-Nature / Panther', 'legacy maps, PID signalling, PANTHER classification', 'pathways'],
      ['HumanCyc / PFOCR', 'human metabolic pathways, gene sets mined from figures', 'no disease'],
      ['MSigDB (3 collections)', 'hallmark states, computational modules, oncogenic signatures', 'no disease'],
    ],
  });
  footer(s, 'maayanlab.cloud/Enrichr', false, '');
  addLogo(s, 'light');
})();

pres.writeFile({ fileName: 'disease-pathways.pptx' }).then((f) => console.log('wrote', f));
