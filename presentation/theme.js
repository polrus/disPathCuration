// Open Targets house-style helpers for pptxgenjs.
// require('./theme.js') from your generator. Keep assets/ next to this file.
// Hex colours never include '#'. See the pptx skill for all pptxgenjs gotchas.

const path = require('path');
const fs = require('fs');
const ASSETS = [path.join(__dirname, 'assets'), path.join(__dirname, '..', 'assets')]
  .find((p) => fs.existsSync(p)) || path.join(__dirname, 'assets');

const C = {
  navy: '1A4565',   // theme dk1 — dark backgrounds, big-stat panels, divider diagonal
  blue: '3489CA',   // Open Targets Blue (primary)
  blue50: '9AC4E4',
  blue30: 'C2DCEF',
  teal: '0097A7',   // theme accent5
  red: 'FF6350',    // Open Targets Red (caution / negative only)
  red50: 'FFB1A8',
  red30: 'FFD0CA',
  grey: '5A5F5F',   // Open Targets Grey (body/captions)
  grey50: 'ACAFAF',
  grey30: 'CECFCF',
  ink: '212121',    // theme accent2 — dense body copy
  paper: 'FFFFFF',
};

// Fonts as actually used across the template's content slides (Roboto dominates ~90%
// of runs; the lone Trebuchet MS title slide is an anomaly, not the house style):
const TITLE_FONT = 'Roboto'; // slide titles/section headers/big numbers — use bold:true
const BODY_FONT = 'Roboto';  // body copy, captions, meta, labels
const LABEL_FONT = 'Roboto Medium';
const SLIDE_TITLE_FONT = 'Trebuchet MS'; // slide titles only

const WORDMARK = path.join(ASSETS, 'ot-wordmark.png');        // colour, on light bg
const WORDMARK_WHITE = path.join(ASSETS, 'ot-wordmark-white.png'); // white, on navy bg
const TITLE_BG = path.join(ASSETS, 'ot-titlebg.png');         // real diagonal title background

const W = 13.33, H = 7.5;      // LAYOUT_WIDE. Set pres.layout='LAYOUT_WIDE' first.
const WM_AR = 2048 / 618;      // wordmark aspect ratio

// Standard bottom-right wordmark. mode 'light' (colour) | 'dark' (white on navy).
function addLogo(slide, mode = 'light') {
  const w = 1.2, h = w / WM_AR;
  slide.addImage({
    path: mode === 'dark' ? WORDMARK_WHITE : WORDMARK,
    x: W - w - 0.45, y: H - h - 0.32, w, h,
  });
}

// Small uppercase kicker label above a title, with a short blue rule.
function kicker(slide, text, x = 0.6, y = 0.42, onDark = false) {
  slide.addShape('rect', { x, y: y + 0.02, w: 0.34, h: 0.09, fill: { color: C.blue }, line: { type: 'none' } });
  slide.addText((text || '').toUpperCase(), {
    x: x + 0.44, y: y - 0.08, w: 8, h: 0.32, fontFace: LABEL_FONT, fontSize: 12,
    color: onDark ? C.blue30 : C.blue, charSpacing: 2, valign: 'middle',
  });
}

// Standard content-slide title (optionally with a kicker above it).
function contentTitle(slide, title, opts = {}) {
  const k = opts.kicker;
  if (k) kicker(slide, k, 0.6, 0.5);
  slide.addText(title, {
    x: 0.6, y: k ? 0.86 : 0.55, w: 12.1, h: 1.05, fontFace: SLIDE_TITLE_FONT, fontSize: opts.fontSize || 36,
    bold: true, color: C.navy, valign: 'top', lineSpacing: 36,
  });
}

// Subtle slide number, bottom-left (clear of the bottom-right logo). 1-based index.
function pageNum(slide, n, onDark = false) {
  slide.addText(String(n), {
    x: 0.45, y: H - 0.42, w: 0.5, h: 0.28, fontFace: BODY_FONT, fontSize: 12,
    color: onDark ? C.grey30 : C.grey50, align: 'left', valign: 'middle',
  });
}

// Navy diagonal motif for hero slides (divider, big-stat). Draw BEFORE text.
// corner: 'br' (default) | 'tr' | 'bl'.
function diagonal(slide, color = C.navy, corner = 'br') {
  const pts = {
    br: [{ x: W, y: H * 0.12 }, { x: W, y: H }, { x: W * 0.42, y: H }],
    tr: [{ x: W * 0.58, y: 0 }, { x: W, y: 0 }, { x: W, y: H * 0.88 }],
    bl: [{ x: 0, y: H * 0.38 }, { x: 0, y: H }, { x: W * 0.58, y: H }],
  }[corner];
  slide.addShape('custGeom', {
    x: 0, y: 0, w: W, h: H, fill: { color }, line: { type: 'none' },
    points: [...pts, { close: true }],
  });
}

// On-brand emoji palette. Rendered by the system emoji font (PowerPoint/Keynote
// substitute Segoe UI Emoji / Apple Color Emoji automatically for these codepoints;
// the embedded Roboto does not cover them, which is expected and fine).
const EMOJI = {
  paper: '\u{1F4DC}',      // 📜 scroll — paper citations (as in the template)
  speech: '\u{1F4AC}',     // 💬 speech balloon — feedback / call-outs (template)
  target: '\u{1F3AF}',     // 🎯 target / prioritisation
  dna: '\u{1F9EC}',        // 🧬 genetics / genomics
  microscope: '\u{1F52C}', // 🔬 experimental
  chart: '\u{1F4CA}',      // 📊 data / results
  pill: '\u{1F48A}',       // 💊 drugs / therapeutics
  flask: '\u{1F9EA}',      // 🧪 assays / chemistry
  search: '\u{1F50D}',     // 🔍 discovery / search
  calendar: '\u{1F4C5}',   // 📅 timelines / roadmap
  check: '\u2705',         // ✅
  cross: '\u274C',         // ❌
  rocket: '\u{1F680}',     // 🚀 launch / next steps
};

// Source / citation line, bottom-left. Prefixes the paper emoji by default
// (matching the template's citations); pass icon:'' to suppress, or another glyph.
function footer(slide, text, onDark = false, icon = EMOJI.paper) {
  slide.addText((icon ? icon + '  ' : '') + text, {
    x: 0.5, y: H - 0.5, w: 9, h: 0.32, fontFace: BODY_FONT, fontSize: 12,
    color: onDark ? C.grey30 : C.grey, align: 'left', valign: 'middle',
  });
}

// TITLE slide over the real template background.
// meta: array of short lines (code, occasion, date, presenter).
function titleSlide(pres, { title, meta = [] }) {
  const s = pres.addSlide();
  s.addImage({ path: TITLE_BG, x: 0, y: 0, w: W, h: H }); // full-bleed diagonal bg
  s.addImage({ path: WORDMARK, x: 0.6, y: 0.5, w: 2.0, h: 2.0 / WM_AR }); // top-left mark
  s.addText(title, {
    x: 0.85, y: 2.4, w: 6.6, h: 2.6, fontFace: SLIDE_TITLE_FONT, fontSize: 36, bold: true,
    color: C.navy, valign: 'top', lineSpacing: 42,
  });
  if (meta.length) {
    s.addText(meta.map((t, i) => ({ text: t, options: { breakLine: true, bold: i === 0 } })), {
      x: 0.85, y: 4.9, w: 6, h: 1.4, fontFace: BODY_FONT, fontSize: 12,
      color: C.navy, valign: 'top', lineSpacingMultiple: 1.2,
    });
  }
  return s;
}

// PART section divider.
function sectionDivider(pres, { part, title }) {
  const s = pres.addSlide();
  s.background = { color: C.paper };
  diagonal(s, C.navy, 'br');
  const cy = 2.6;
  s.addShape('rect', { x: 0.6, y: cy + 0.06, w: 0.28, h: 0.28, fill: { color: C.blue }, line: { type: 'none' } });
  s.addText((part || '').toUpperCase(), {
    x: 1.0, y: cy, w: 6, h: 0.45, fontFace: LABEL_FONT, fontSize: 15,
    color: C.blue, charSpacing: 2, valign: 'middle',
  });
  s.addText(title, {
    x: 0.58, y: cy + 0.55, w: 6.8, h: 2.4, fontFace: SLIDE_TITLE_FONT, fontSize: 44, bold: true,
    color: C.navy, valign: 'top', lineSpacing: 48,
  });
  addLogo(s, 'light');
  return s;
}

// Big single-number hook. onDark navy background by default.
function bigStat(pres, { number, caption, ref, onDark = true }) {
  const s = pres.addSlide();
  s.background = { color: onDark ? C.navy : C.paper };
  // subtle depth: a slightly lighter/darker diagonal in the far corner
  s.addShape('custGeom', {
    x: 0, y: 0, w: W, h: H, line: { type: 'none' },
    fill: { color: onDark ? '234E70' : 'F1F4F8' },
    points: [{ x: W, y: H * 0.45 }, { x: W, y: H }, { x: W * 0.68, y: H }, { close: true }],
  });
  // slim accent bar left of the number
  s.addShape('rect', { x: 0.6, y: 2.35, w: 0.14, h: 2.35, fill: { color: C.blue }, line: { type: 'none' } });
  s.addText(number, {
    x: 0.95, y: 2.15, w: 11.4, h: 2.1, fontFace: TITLE_FONT, fontSize: 128, bold: true,
    color: onDark ? C.paper : C.navy, align: 'left', valign: 'middle',
  });
  s.addText(caption, {
    x: 1.0, y: 4.35, w: 10.5, h: 1.0, fontFace: BODY_FONT, fontSize: 22,
    color: onDark ? C.blue30 : C.grey, align: 'left', valign: 'top',
  });
  if (ref) footer(s, ref, onDark);
  addLogo(s, onDark ? 'dark' : 'light');
  return s;
}

// N-column concept slide as balanced cards. cols: [{label, body, chip}] (2 or 3).
function columns(pres, { title, kicker: kick, cols }) {
  const s = pres.addSlide();
  s.background = { color: C.paper };
  contentTitle(s, title, { kicker: kick });
  const n = cols.length, gap = 0.5, mx = 0.6;
  const colW = (W - 2 * mx - (n - 1) * gap) / n;
  const cardY = 1.95, cardH = 4.4;
  cols.forEach((c, i) => {
    const x = mx + i * (colW + gap);
    // card panel
    s.addShape('roundRect', { x, y: cardY, w: colW, h: cardH, rectRadius: 0.06,
      fill: { color: 'F4F6F9' }, line: { type: 'none' } });
    const padX = 0.35;
    let cy = cardY + 0.4;
    if (c.chip !== undefined) {
      s.addShape('ellipse', { x: x + padX, y: cy, w: 0.66, h: 0.66, fill: { color: C.blue }, line: { type: 'none' } });
      s.addText(String(c.chip), { x: x + padX, y: cy, w: 0.66, h: 0.66, margin: 0,
        fontFace: TITLE_FONT, fontSize: 22, bold: true, color: C.paper, align: 'center', valign: 'middle' });
      cy += 0.95;
    }
    s.addText(c.label, { x: x + padX, y: cy, w: colW - padX * 2, h: 0.5, fontFace: LABEL_FONT,
      fontSize: 18, color: C.navy, valign: 'top' });
    s.addText(c.body, { x: x + padX, y: cy + 0.55, w: colW - padX * 2, h: cardH - (cy - cardY) - 0.9,
      fontFace: BODY_FONT, fontSize: 14, color: C.ink, valign: 'top', lineSpacing: 21 });
  });
  addLogo(s, 'light');
  return s;
}

// Pros/cons (research questions vs will-not-do) — two headed columns with tick/cross rows.
// left/right: {heading, items:[...]}. leftIcon default green tick, rightIcon red cross.
function prosCons(pres, { title, sub, left, right }) {
  const s = pres.addSlide();
  s.background = { color: C.paper };
  s.addText(title, { x: 0.6, y: 0.4, w: 12, h: 0.95, fontFace: TITLE_FONT, fontSize: 36,
    bold: true, color: C.navy });
  if (sub) s.addText(sub, { x: 0.6, y: 1.0, w: 12, h: 0.5, fontFace: BODY_FONT,
    fontSize: 13, color: C.grey });
  const cols = [
    { data: left, x: 0.6, head: C.blue, mark: '\u2713', markColor: '2E7D32' },
    { data: right, x: 6.9, head: C.navy, mark: '\u2717', markColor: C.red },
  ];
  cols.forEach((c) => {
    const w = 5.8;
    s.addShape('roundRect', { x: c.x, y: 1.7, w, h: 0.55, rectRadius: 0.06,
      fill: { color: c.head }, line: { type: 'none' } });
    s.addText(c.data.heading, { x: c.x, y: 1.7, w, h: 0.55, margin: 4, fontFace: BODY_FONT,
      fontSize: 14, bold: true, color: C.paper, align: 'center', valign: 'middle' });
    c.data.items.forEach((it, i) => {
      const y = 2.5 + i * 0.72;
      s.addText(c.mark, { x: c.x, y, w: 0.5, h: 0.5, margin: 0, fontFace: BODY_FONT,
        fontSize: 18, bold: true, color: c.markColor, align: 'center', valign: 'top' });
      s.addText(it, { x: c.x + 0.55, y, w: w - 0.6, h: 0.7, fontFace: BODY_FONT,
        fontSize: 12, color: C.ink, valign: 'top', lineSpacing: 15 });
    });
  });
  addLogo(s, 'light');
  return s;
}

// Roadmap — month timeline with milestone markers.
// months: ['May','Jun',...]; milestones: [{month, label, key(bool)}]
function roadmap(pres, { title, sub, months, milestones, band, bandIconOff }) {
  const s = pres.addSlide();
  s.background = { color: C.paper };
  s.addText(title, { x: 0.6, y: 0.4, w: 12, h: 0.95, fontFace: TITLE_FONT, fontSize: 36,
    bold: true, color: C.navy });
  if (sub) s.addText(sub, { x: 0.6, y: 1.0, w: 12, h: 0.6, fontFace: BODY_FONT,
    fontSize: 13, italic: true, color: C.grey });
  const x0 = 0.9, x1 = 12.4, ty = 3.2;
  const n = months.length, step = (x1 - x0) / (n - 1);
  // baseline
  s.addShape('line', { x: x0, y: ty, w: x1 - x0, h: 0, line: { color: C.grey30, width: 2 } });
  months.forEach((m, i) => {
    const x = x0 + i * step;
    s.addShape('ellipse', { x: x - 0.05, y: ty - 0.05, w: 0.1, h: 0.1, fill: { color: C.grey50 }, line: { type: 'none' } });
    s.addText(m, { x: x - 0.5, y: ty + 0.15, w: 1.0, h: 0.3, fontFace: BODY_FONT,
      fontSize: 12, color: C.grey, align: 'center' });
  });
  milestones.forEach((ms, i) => {
    const idx = months.indexOf(ms.month);
    const x = x0 + idx * step;
    const col = ms.key ? C.red : C.blue;
    const up = i % 2 === 0;
    const my = up ? ty - 0.9 : ty + 0.7;
    s.addShape('line', { x, y: Math.min(my + 0.18, ty), w: 0, h: Math.abs(ty - (my + 0.18)),
      line: { color: col, width: 1.5, dashType: 'dash' } });
    s.addShape('ellipse', { x: x - 0.09, y: ty - 0.09, w: 0.18, h: 0.18, fill: { color: col }, line: { type: 'none' } });
    const lx = Math.max(0.3, Math.min(x - 1.1, W - 2.5));
    s.addText(ms.label, { x: lx, y: my, w: 2.2, h: 0.5, fontFace: BODY_FONT,
      fontSize: 12, bold: ms.key, color: ms.key ? C.red : C.navy, align: 'center',
      valign: up ? 'bottom' : 'top' });
  });
  if (band) {
    s.addShape('rect', { x: 0, y: H - 1.0, w: W, h: 1.0, fill: { color: C.navy }, line: { type: 'none' } });
    const bandIcon = bandIconOff ? '' : EMOJI.speech + '  ';
    s.addText(bandIcon + band, { x: 0.6, y: H - 1.0, w: 11.5, h: 1.0, fontFace: BODY_FONT, fontSize: 16,
      bold: true, color: C.paper, valign: 'middle' });
  }
  addLogo(s, 'light');
  return s;
}


// The template draws flows as rounded-rectangle "stage" boxes in brand blue with
// white bold labels, small circular entity chips (T = target), a coral box for a
// highlighted step, and thin navy arrows. No PowerPoint connectors — everything is
// a shape, positioned on an inch grid.

// A rounded-rectangle stage/node. opts: {x,y,w,h,label,fill,color,fontSize,sub}
function node(slide, o) {
  const fill = o.fill || C.blue;
  slide.addShape('roundRect', {
    x: o.x, y: o.y, w: o.w, h: o.h || 0.7, rectRadius: 0.08,
    fill: { color: fill }, line: { type: 'none' },
    shadow: { type: 'outer', color: '000000', opacity: 0.18, blur: 4, offset: 2, angle: 90 },
  });
  slide.addText(o.label, {
    x: o.x, y: o.y, w: o.w, h: o.h || 0.7, margin: 2,
    fontFace: LABEL_FONT, fontSize: o.fontSize || 13,
    color: o.color || C.paper, align: 'center', valign: 'middle',
  });
  if (o.sub) slide.addText(o.sub, {
    x: o.x, y: o.y + (o.h || 0.7), w: o.w, h: 0.3, fontFace: BODY_FONT, fontSize: 12,
    color: C.grey, align: 'center', valign: 'top',
  });
}

// A coral highlight box (the template's GSEA-style emphasised step).
function coralBox(slide, o) {
  node(slide, { ...o, fill: o.fill || C.red });
}

// Small circular entity chip, e.g. a target "T" or pathway node.
function chip(slide, o) {
  const d = o.d || 0.34;
  slide.addShape('ellipse', {
    x: o.x, y: o.y, w: d, h: d,
    fill: { color: o.fill || C.blue }, line: { type: 'none' },
  });
  if (o.label) slide.addText(o.label, {
    x: o.x, y: o.y, w: d, h: d, margin: 0, fontFace: BODY_FONT,
    fontSize: o.fontSize || 11, bold: true, color: o.color || C.paper,
    align: 'center', valign: 'middle',
  });
}

// A thin arrow between two points (navy by default). Horizontal or vertical.
function arrow(slide, x1, y1, x2, y2, color = C.navy) {
  slide.addShape('line', {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width: 2, endArrowType: 'triangle' },
  });
}

// A schema slide scaffold: navy header bar + title, a content band, footer citation.
// Returns the slide so the caller draws nodes/chips/arrows into the band.
// opts: {title, ref}. Band is roughly y:1.4 .. 6.4, x:0.5 .. 12.8.
function schemaSlide(pres, { title, ref }) {
  const s = pres.addSlide();
  s.background = { color: C.paper };
  s.addShape('rect', { x: 0, y: 0, w: W, h: 1.05, fill: { color: C.navy }, line: { type: 'none' } });
  s.addShape('rect', { x: 0, y: 1.05, w: W, h: 0.06, fill: { color: C.blue }, line: { type: 'none' } });
  s.addText(title, {
    x: 0.6, y: 0, w: 11.5, h: 1.05, fontFace: SLIDE_TITLE_FONT, fontSize: 28, bold: true,
    color: C.paper, align: 'left', valign: 'middle',
  });
  if (ref) footer(s, ref);
  addLogo(s, 'light');
  return s;
}

// A cohesive horizontal pipeline diagram. Each stage is a lane: a coloured header
// pill joined by arrows, with a light card body beneath holding chips + a caption.
// Fills the full slide height and keeps sub-content visually attached to its stage.
// stages: [{ label, fill?, chips?:[{t,fill?,color?}], caption?, detail?:[str] }]
function schemaFlow(pres, { title, ref, stages }) {
  const s = schemaSlide(pres, { title, ref });
  const n = stages.length, mx = 0.6, gap = 0.4;
  const laneW = (W - 2 * mx - (n - 1) * gap) / n;
  const headY = 1.55, headH = 0.8;
  const bodyY = 2.65, bodyBottom = 6.5, bodyH = bodyBottom - bodyY;

  stages.forEach((st, i) => {
    const x = mx + i * (laneW + gap);
    s.addShape('roundRect', { x, y: bodyY, w: laneW, h: bodyH, rectRadius: 0.06,
      fill: { color: 'F4F6F9' }, line: { type: 'none' } });
    node(s, { x, y: headY, w: laneW, h: headH, label: st.label, fill: st.fill || C.blue });
    if (i < n - 1) arrow(s, x + laneW, headY + headH / 2, x + laneW + gap, headY + headH / 2);

    let cy = bodyY + 0.35;
    if (st.chips && st.chips.length) {
      const d = 0.4, cgap = 0.18;
      const totalW = st.chips.length * d + (st.chips.length - 1) * cgap;
      let cx = x + (laneW - totalW) / 2;
      st.chips.forEach((c) => {
        chip(s, { x: cx, y: cy, d, label: c.t, fill: c.fill || C.blue, color: c.color || C.paper, fontSize: 12 });
        cx += d + cgap;
      });
      cy += d + 0.35;
    }
    if (st.detail && st.detail.length) {
      s.addText(st.detail.map((t) => ({ text: t, options: { breakLine: true } })), {
        x: x + 0.25, y: cy, w: laneW - 0.5, h: 1.4, fontFace: BODY_FONT, fontSize: 12,
        color: C.ink, valign: 'top', lineSpacing: 18, bullet: { code: '2022', indent: 12 },
      });
    }
    if (st.caption) {
      s.addText(st.caption, {
        x: x + 0.25, y: bodyBottom - 1.45, w: laneW - 0.5, h: 1.3, fontFace: BODY_FONT,
        fontSize: 12, color: C.grey, align: 'center', valign: 'bottom', lineSpacing: 16,
      });
    }
  });
  return s;
}

// OT-styled data table, drawn as shapes for full control (not a flat grid).
// Features: navy header + blue accent rule, bold navy key column, alternating
// blue-tint row bands, right-aligned numeric columns, category pills, and optional
// Excel-style data bars behind one numeric column. All text >=12pt.
// opts: { x, y, w, headers, rows, colW, keyCol=0, numCols=[], pillCol, barCol, fontSize=12 }
function table(slide, o) {
  const x = o.x ?? 0.6, y = o.y ?? 1.85, w = o.w ?? 12.1;
  const headers = o.headers, rows = o.rows;
  const nCol = headers.length;
  const colW = o.colW || Array(nCol).fill(w / nCol);
  const xs = []; let acc = x;
  colW.forEach((cw) => { xs.push(acc); acc += cw; });
  const keyCol = o.keyCol ?? 0;
  const numCols = new Set(o.numCols || []);
  const fs = o.fontSize || 12;
  const headH = 0.52, rowH = 0.5, pad = 0.14;
  const isNum = (i) => numCols.has(i) || i === o.barCol;

  // header bar + blue accent rule
  slide.addShape('rect', { x, y, w, h: headH, fill: { color: C.navy }, line: { type: 'none' } });
  slide.addShape('rect', { x, y: y + headH, w, h: 0.05, fill: { color: C.blue }, line: { type: 'none' } });
  headers.forEach((h, i) => {
    slide.addText(h, { x: xs[i] + pad, y, w: colW[i] - pad * 2, h: headH, fontFace: LABEL_FONT,
      fontSize: fs + 1, bold: true, color: C.paper, align: isNum(i) ? 'right' : 'left', valign: 'middle' });
  });

  // data-bar scale
  let barMax = 0;
  if (o.barCol != null) barMax = Math.max(...rows.map((r) => parseFloat(String(r[o.barCol]).replace(/[^0-9.]/g, '')) || 0));

  const bodyY = y + headH + 0.05;
  rows.forEach((r, ri) => {
    const ry = bodyY + ri * rowH;
    slide.addShape('rect', { x, y: ry, w, h: rowH, fill: { color: ri % 2 ? 'EAF2FB' : C.paper }, line: { type: 'none' } });
    r.forEach((cell, i) => {
      const cx = xs[i], cw = colW[i], val = String(cell);
      if (i === o.pillCol) {
        const pw = Math.min(cw - pad * 2, 0.28 + val.length * 0.092 * (fs / 12));
        slide.addShape('roundRect', { x: cx + pad, y: ry + (rowH - 0.32) / 2, w: pw, h: 0.32, rectRadius: 0.16,
          fill: { color: C.blue30 }, line: { type: 'none' } });
        slide.addText(val, { x: cx + pad, y: ry + (rowH - 0.32) / 2, w: pw, h: 0.32, margin: 0,
          fontFace: LABEL_FONT, fontSize: fs, color: C.navy, align: 'center', valign: 'middle' });
      } else {
        if (i === o.barCol && barMax > 0) {
          const num = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
          const track = cw - pad * 2, bw = Math.max(0.05, track * (num / barMax));
          slide.addShape('roundRect', { x: cx + pad, y: ry + rowH - 0.16, w: track, h: 0.08, rectRadius: 0.04,
            fill: { color: 'E1E7EF' }, line: { type: 'none' } });
          slide.addShape('roundRect', { x: cx + pad, y: ry + rowH - 0.16, w: bw, h: 0.08, rectRadius: 0.04,
            fill: { color: C.blue }, line: { type: 'none' } });
        }
        const key = i === keyCol;
        slide.addText(val, { x: cx + pad, y: i === o.barCol ? ry - 0.02 : ry, w: cw - pad * 2,
          h: i === o.barCol ? rowH - 0.14 : rowH, fontFace: key ? LABEL_FONT : BODY_FONT, fontSize: fs,
          bold: key, color: key ? C.navy : C.ink, align: isNum(i) ? 'right' : 'left',
          valign: i === o.barCol ? 'top' : 'middle' });
      }
    });
  });
  return bodyY + rows.length * rowH;
}

// Rounded label with no stroke. The deck's basic infographic atom: an ontology
// term, a label fragment, a verdict. Verdict colours: VERDICT.keep / .reject /
// .none.
function pill(slide, o) {
  slide.addShape('roundRect', { x: o.x, y: o.y, w: o.w, h: o.h || 0.34, rectRadius: 0.08,
    fill: { color: o.fill || C.blue30 }, line: { type: 'none' } });
  slide.addText(o.text, { x: o.x, y: o.y, w: o.w, h: o.h || 0.34, margin: 2,
    fontFace: o.font || BODY_FONT, fontSize: o.fontSize || 12, bold: o.bold || false,
    color: o.color || C.navy, align: o.align || 'center', valign: 'middle' });
}

// Flat panel, no outline. Structure comes from fill contrast, never a border.
function card(slide, o) {
  slide.addShape('roundRect', { x: o.x, y: o.y, w: o.w, h: o.h, rectRadius: 0.06,
    fill: { color: o.fill || 'F4F6F9' }, line: { type: 'none' } });
}

// Fixed verdict palette, so a reader learns the colours once.
const VERDICT = {
  keep: { fill: 'DDF0E2', color: '1E6B33' },
  reject: { fill: C.red30, color: 'A33224' },
  none: { fill: 'D5DAE2', color: C.grey },
};

module.exports = { C, TITLE_FONT, BODY_FONT, W, H, WORDMARK, WORDMARK_WHITE, TITLE_BG,
  addLogo, diagonal, footer, titleSlide, sectionDivider, bigStat, columns,
  schemaSlide, schemaFlow, table, node, chip, arrow, coralBox, prosCons, roadmap,
  kicker, contentTitle, pageNum, LABEL_FONT, SLIDE_TITLE_FONT, EMOJI,
  pill, card, VERDICT };
