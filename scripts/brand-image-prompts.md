# one3seven — locked brand-image prompts

A small, consistent set so every visual (landing page, deck, social) shares one **visual DNA**.
Run them through `scripts/gen-image.mjs`. Edit the prompts in `scripts/brand-image-presets.json`.

## The shared DNA (don't drift from this — consistency is what reads as "a brand")
- **Light:** soft directional studio light from the **upper left**, deep ink shadows.
- **Palette:** deep violet `#5B21B6` + near-black ink, **one** warm off-white highlight. Monochromatic, restrained.
- **Texture:** matte vellum / paper, subtle film grain.
- **Motif:** scattered documents resolving into one ordered line; a faint golden-angle seed spiral (one3seven = 137.5°).
- **Style anchor:** Aesop-meets-Kinfolk editorial restraint. Generous negative space for text.
- **Always:** specify aspect ratio in-prompt; `no text, no lettering, no logos` (Flash can't render clean text).

## The four presets

| Preset | Use | Ratio | Command |
|---|---|---|---|
| `hero` | Landing-page hero background | 16:9 | `node scripts/gen-image.mjs --preset hero hero.png --n 4` |
| `social` | Square social card background | 1:1 | `node scripts/gen-image.mjs --preset social social.png --n 4` |
| `deck-bg` | Deck / slide background (very empty) | 16:9 | `node scripts/gen-image.mjs --preset deck-bg deck-bg.png --n 4` |
| `about-texture` | "About"/section texture band | 3:2 | `node scripts/gen-image.mjs --preset about-texture texture.png --n 4` |

## Workflow (the part that matters)
1. Run a preset with `--n 4`.
2. Pick the strongest of the four.
3. Refine **one** thing in the JSON prompt (e.g. "more negative space upper third") and regenerate.
4. Keep the winners. Reuse the same presets every time so the set stays coherent.

## Notes
- All presets are **text-free backgrounds** by design — overlay headlines in your design tool. That keeps them reusable and avoids Flash's gibberish text.
- If you ever want a headline **baked into** the image, switch that preset to `--model gemini-3-pro-image-preview` (Pro renders readable text) and add the exact headline to the prompt.
- Marketing assets only. Never use this near worker documents, intake, or product output.
