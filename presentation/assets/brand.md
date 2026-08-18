# Open Targets brand reference

Source: the official 2022 Open Targets presentation template ("Resources" slide) plus theme colours.

## Colours

| Name | Hex | Notes |
|---|---|---|
| Open Targets Blue | `3489CA` | Primary. Tints: 50% `9AC4E4`, 30% `C2DCEF` |
| Open Targets Red | `FF6350` | Caution / negative only. Tints: 50% `FFB1A8`, 30% `FFD0CA` |
| Open Targets Grey | `5A5F5F` | Body/captions. Tints: 50% `ACAFAF`, 30% `CECFCF` |
| Navy | `1A4565` | Dark backgrounds and big-stat panels (theme colour) |
| Teal | `0097A7` | Secondary accent (theme colour) |
| Ink | `212121` | Dense body copy |
| Paper | `FFFFFF` | Default background |

Tints are computed over white (opacity of the base colour): 50% and 30% as the template specifies.

## Type

- Titles / big numbers / section headers: **Roboto**, bold.
- Body / captions / meta / labels: **Roboto**.
- The house font is Roboto throughout (bold for headings). The theme declares Arial and one legacy slide uses Trebuchet MS - ignore both. Roboto is often not installed locally, so embed it in the .pptx or fall back to Arial/Helvetica Neue for portability.

## Logo

- `ot-wordmark.png` — full Open Targets wordmark (colour), use on light backgrounds (`addLogo(slide,'light')`).
- `ot-wordmark-white.png` — white wordmark, use on navy backgrounds (`addLogo(slide,'dark')`).
- `ot-titlebg.png` — the real title-slide diagonal background (1920x1080), used by `titleSlide`.
- Standard placement: small mark, bottom-right footer. Larger top-left on the title slide.

## Voice

UK spelling. No em dashes, no semicolons. Concise, plain, precise. Data-bottleneck framing. Keep association scoring distinct from traffic-light prioritisation.

## Emoji

Paper citations use 📜 and feedback call-outs use 💬 (both applied automatically). An `EMOJI` palette (🎯 🧬 🔬 📊 💊 🧪 🔍 📅 ✅ ❌ 🚀) is available for occasional use in titles or labels. Emoji render through the system emoji font, not the embedded Roboto.
