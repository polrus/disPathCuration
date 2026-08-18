#!/usr/bin/env python3
"""Embed TrueType fonts into a .pptx so it renders identically on any machine.

Roboto (the Open Targets house font) is not installed on macOS or many renderers,
so an un-embedded deck substitutes another face. Run this after generating the deck.

Usage:
    python embed_fonts.py deck.pptx \
        --font Roboto:regular=fonts/Roboto-Regular.ttf,bold=fonts/Roboto-Bold.ttf

Multiple --font flags allowed (one per typeface). Styles: regular, bold, italic, boldItalic.
Edits the package in place (writes deck.pptx). Fonts must be embeddable (Roboto is).
"""
import argparse, os, shutil, sys, tempfile, zipfile
from defusedxml.minidom import parseString

A_MAIN = "http://schemas.openxmlformats.org/presentationml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL_FONT = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font"
CT_FONT = "application/x-fontdata"


def parse_font_arg(arg):
    # "Roboto:regular=path,bold=path2"
    name, _, rest = arg.partition(":")
    styles = {}
    for pair in rest.split(","):
        style, _, path = pair.partition("=")
        styles[style.strip()] = path.strip()
    return name.strip(), styles


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pptx")
    ap.add_argument("--font", action="append", required=True,
                    help="Typeface:style=path,... e.g. Roboto:regular=a.ttf,bold=b.ttf")
    args = ap.parse_args()

    fonts = [parse_font_arg(f) for f in args.font]
    for _, styles in fonts:
        for p in styles.values():
            if not os.path.exists(p):
                sys.exit(f"font file not found: {p}")

    work = tempfile.mkdtemp()
    try:
        with zipfile.ZipFile(args.pptx) as z:
            z.extractall(work)

        # 1. copy font parts into ppt/fonts/
        fonts_dir = os.path.join(work, "ppt", "fonts")
        os.makedirs(fonts_dir, exist_ok=True)
        idx = 0
        # rId numbering: continue after existing rels
        rels_path = os.path.join(work, "ppt", "_rels", "presentation.xml.rels")
        rels = parseString(open(rels_path, "rb").read())
        existing_ids = [int(r.getAttribute("Id")[3:]) for r in rels.getElementsByTagName("Relationship")
                        if r.getAttribute("Id").startswith("rId") and r.getAttribute("Id")[3:].isdigit()]
        next_rid = (max(existing_ids) + 1) if existing_ids else 1

        embed_entries = []  # (typeface, {style: rid})
        for name, styles in fonts:
            style_rids = {}
            for style, path in styles.items():
                idx += 1
                fn = f"font{idx}.fntdata"
                shutil.copy(path, os.path.join(fonts_dir, fn))
                rid = f"rId{next_rid}"; next_rid += 1
                style_rids[style] = (rid, fn)
            embed_entries.append((name, style_rids))

        # 2. relationships
        rels_root = rels.documentElement
        for _, style_rids in embed_entries:
            for style, (rid, fn) in style_rids.items():
                rel = rels.createElement("Relationship")
                rel.setAttribute("Id", rid)
                rel.setAttribute("Type", REL_FONT)
                rel.setAttribute("Target", f"fonts/{fn}")
                rels_root.appendChild(rel)
        with open(rels_path, "w", encoding="utf-8") as f:
            f.write(rels.toxml())

        # 3. content types: default for fntdata
        ct_path = os.path.join(work, "[Content_Types].xml")
        ct = parseString(open(ct_path, "rb").read())
        has_default = any(d.getAttribute("Extension") == "fntdata"
                          for d in ct.getElementsByTagName("Default"))
        if not has_default:
            d = ct.createElement("Default")
            d.setAttribute("Extension", "fntdata")
            d.setAttribute("ContentType", CT_FONT)
            ct.documentElement.insertBefore(d, ct.documentElement.firstChild)
        with open(ct_path, "w", encoding="utf-8") as f:
            f.write(ct.toxml())

        # 4. presentation.xml: set embedTrueTypeFonts + insert embeddedFontLst
        pres_path = os.path.join(work, "ppt", "presentation.xml")
        pres = parseString(open(pres_path, "rb").read())
        root = pres.documentElement
        root.setAttribute("embedTrueTypeFonts", "1")
        root.setAttribute("saveSubsetFonts", "0")

        lst = pres.createElement("p:embeddedFontLst")
        for name, style_rids in embed_entries:
            ef = pres.createElement("p:embeddedFont")
            font = pres.createElement("p:font")
            font.setAttribute("typeface", name)
            ef.appendChild(font)
            for style in ("regular", "bold", "italic", "boldItalic"):
                if style in style_rids:
                    rid = style_rids[style][0]
                    el = pres.createElement(f"p:{style}")
                    el.setAttribute("r:id", rid)
                    ef.appendChild(el)
            lst.appendChild(ef)

        # embeddedFontLst must sit after notesSz and before defaultTextStyle/extLst.
        anchor = None
        for tag in ("p:notesSz", "p:sldSz", "p:sldIdLst"):
            els = root.getElementsByTagName(tag)
            if els:
                anchor = els[0]; break
        if anchor and anchor.nextSibling:
            root.insertBefore(lst, anchor.nextSibling)
        else:
            root.appendChild(lst)

        # ensure r: namespace is declared on the root (pptxgenjs already does)
        if not root.getAttribute("xmlns:r"):
            root.setAttribute("xmlns:r", R_NS)

        with open(pres_path, "w", encoding="utf-8") as f:
            f.write(pres.toxml())

        # 5. repack
        tmp_out = args.pptx + ".tmp"
        with zipfile.ZipFile(tmp_out, "w", zipfile.ZIP_DEFLATED) as z:
            for base, _, files in os.walk(work):
                for fn in files:
                    fp = os.path.join(base, fn)
                    arc = os.path.relpath(fp, work)
                    z.write(fp, arc)
        shutil.move(tmp_out, args.pptx)
        total = sum(len(s) for _, s in embed_entries)
        print(f"Embedded {total} font style(s) into {args.pptx}")
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
