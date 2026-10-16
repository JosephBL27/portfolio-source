# Visual provenance and assets

The shipped interface does not contain historical plates, scans, museum photography, or copied reference screenshots. Its radial register, seal marks, paper layers, ledger rules, and story-world chart are authored interface elements—not presented as historical evidence.

## Generated material assets

Four original raster assets were generated for this interface with OpenAI's built-in image-generation tool on 2026-08-06 and 2026-08-08:

- `assets/materials/cut-paper-fox-breach.webp` — a frameless cinnabar, ivory, and lampblack fox assembled as layered xuan-paper and dry woodblock forms. It was generated against a flat chroma-key field, removed locally with the bundled soft-matte/despill helper, and validated with transparent corners. A rejected ringed study is retained only with the private design sources and is not shipped.
- `assets/materials/indigo-docket-cloth.webp` — a low-contrast indigo woven-cloth field with faint cloud-and-water woodblock wear, used beneath the interactive register.
- `assets/materials/stacked-record-leaves.webp` — separate, deckled xuan-paper leaves, ruled columns, a binder clip, faded cord, and a deliberately illegible worn impression. It sits behind the dossier as material depth, never as interface text.
- `assets/materials/woodblock-taxonomy.webp` — eight original interpretive printmarks for figure, household, institution, authority, spirit, motif, locus, and term. The adjacent caption discloses their generated provenance in the live interface.

The production prompts required early-Qing literati-album material cues, restrained color, no copied artwork, no readable characters or seals, no text, no watermark, and no Greek or Roman ornament. These assets are contemporary generated art direction, not period artifacts or historical evidence. All semantic and interactive register targets remain separate authored SVG/HTML above the raster material. Production copies were downsampled and encoded as WebP; full-resolution sources stay outside the shipped public bundle under the project design artifacts.

## Institutional source pass

These sources informed the material and editorial direction:

- **National Museum of China — “Endless Stories: Pu Songling and His Liaozhai Zhiyi.”** Collection-specific exhibition context for Pu Songling, the anthology, and its material afterlives: <https://en.chnmuseum.cn/exhibition/exhibition_series/temporary_exhibitions/historical_and_cultural_exhibition/202606/t20260622_279753.html>
- **The Metropolitan Museum of Art — “The Printed Image in China.”** Context for Chinese woodblock printing, books, and the circulation of printed images: <https://www.metmuseum.org/exhibitions/listings/2012/printed-image-in-china>
- **The British Museum — Liaozhai-associated ink painting.** An inspectable collection object connected to the narrative tradition: <https://www.britishmuseum.org/collection/object/A_1990-1127-0-7>
- **The Cambridge History of Chinese Literature — “Early Qing to 1723.”** Literary-historical context for the early Qing setting: <https://www.cambridge.org/core/books/abs/cambridge-history-of-chinese-literature/early-qing-to-1723/D6E740C64EDB9E678E2F8E8911FEBB23>

The application does not reproduce these pages or derive UI text from their captions. They are linked in the Method workspace so the contextual pass remains inspectable.

## Generated design studies

Three local art-direction studies are recorded under `.impeccable/mocks/` as prompt and generation-metadata sidecars. The surviving records document the cropped register, overlapping dossier, and full-width fifteen-slip route explored before implementation; no comp PNG is retained or shipped. The production interface is authored from those study records rather than using a generated page composition as a background, and the records contain no authoritative textual claims.

## Fonts and interface libraries

- Literata Variable and Noto Serif SC Variable are installed through Fontsource packages.
- Barlow Condensed is installed through Fontsource for docket labels.
- Lucide supplies utility icons.

Exact package-provided SIL Open Font License 1.1 notices ship beside the font files:

- [Literata license](licenses/Literata-OFL-1.1.txt)
- [Noto Serif SC license](licenses/Noto-Serif-SC-OFL-1.1.txt)
- [Barlow Condensed license](licenses/Barlow-Condensed-OFL-1.1.txt)

The remaining library licenses are recorded in their package metadata and lockfile; no project-wide license is assigned by this file.
