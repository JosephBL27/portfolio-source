---
version: alpha
name: "Metamorphoses: Joseph Blumberg portfolio (v4)"
description: "A gesture-driven camera flight through one particle cosmos on near-black (#050506). The chrome is ivory ink and hairlines that step back; colour lives in the 3D forms, each area keeps its own native accent, and the name sits on the Milky Way. Display type is Bodoni Moda (uppercase, optical size 44) beside Instrument Serif italic, Archivo for reading and IBM Plex Mono for labels."
colors:
  primary: "#EDE6D6"
  ground: "#050506"
  ink-dim: "color-mix(in srgb, #EDE6D6 74%, transparent)"
  hair: "color-mix(in srgb, #EDE6D6 34%, transparent)"
  hair-soft: "color-mix(in srgb, #EDE6D6 16%, transparent)"
  scrim: "rgba(5, 5, 6, 0.62)"
  scrim-panel: "rgba(5, 5, 6, 0.78)"
  scrim-chip: "rgba(5, 5, 6, 0.5)"
  glass-hud: "color-mix(in srgb, #050506 52%, transparent)"
  hero-ivory: "#FFF6DE"
  area-work: "#B48CFF"
  area-systems: "#FF4A2B"
  area-research: "#FF6A8A"
  area-mind: "#8FB8FF"
  area-education: "#D9A441"
  case-paper: "#0E0F10"
  case-ink: "#ECEAE3"
  case-accent-default: "#FF6A4D"
typography:
  display-hero:
    fontFamily: "Bodoni Moda Variable, Bodoni Moda, Bodoni 72, Didot, Times New Roman, serif"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: 0em
  display-title:
    fontFamily: "Bodoni Moda Variable, Bodoni Moda, Bodoni 72, Didot, Times New Roman, serif"
    fontSize: 120px
    fontWeight: 640
    lineHeight: 0.9
    letterSpacing: -0.015em
    fontVariation: "'opsz' 44"
  display-index:
    fontFamily: "Bodoni Moda Variable, Bodoni Moda, Bodoni 72, Didot, Times New Roman, serif"
    fontSize: 148px
    fontWeight: 600
    lineHeight: 0.82
    letterSpacing: -0.02em
    fontVariation: "'opsz' 96"
  display-stat:
    fontFamily: "Bodoni Moda Variable, Bodoni Moda, Bodoni 72, Didot, Times New Roman, serif"
    fontSize: 150px
    fontWeight: 640
    lineHeight: 0.85
    letterSpacing: -0.03em
    fontVariation: "'opsz' 44"
  display-name:
    fontFamily: "Bodoni Moda Variable, Bodoni Moda, Bodoni 72, Didot, Times New Roman, serif"
    fontSize: 76px
    fontWeight: 640
    lineHeight: 0.98
    letterSpacing: -0.015em
    fontVariation: "'opsz' 44"
  display-case:
    fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: -0.035em
  claim-italic:
    fontFamily: "Instrument Serif, Times New Roman, serif"
    fontSize: 70px
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: -0.012em
  lede-italic:
    fontFamily: "Instrument Serif, Times New Roman, serif"
    fontSize: 28px
    fontWeight: 400
    lineHeight: 1.22
    letterSpacing: -0.003em
  title-italic:
    fontFamily: "Instrument Serif, Times New Roman, serif"
    fontSize: 26px
    fontWeight: 400
    lineHeight: 1.1
  body-lg:
    fontFamily: "Archivo Variable, Archivo, system-ui, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: 21px
    fontWeight: 400
    lineHeight: 1.5
    fontVariation: "'wdth' 96"
  body-md:
    fontFamily: "Archivo Variable, Archivo, system-ui, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.55
  body-strong:
    fontFamily: "Archivo Variable, Archivo, system-ui, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: 17px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.005em
    fontVariation: "'wdth' 98"
  action:
    fontFamily: "Archivo Variable, Archivo, system-ui, -apple-system, Helvetica Neue, Arial, sans-serif"
    fontSize: 14.5px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: 0.005em
  label-mono:
    fontFamily: "IBM Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: 11.5px
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: 0.13em
  button-mono:
    fontFamily: "IBM Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.14em
  chip-mono:
    fontFamily: "IBM Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: 0.1em
  figure-mono:
    fontFamily: "IBM Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: 64px
    fontWeight: 500
    lineHeight: 0.95
    letterSpacing: -0.05em
    fontFeature: "'tnum' 1"
  counter-mono:
    fontFamily: "IBM Plex Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: 150px
    fontWeight: 500
    lineHeight: 0.8
    letterSpacing: -0.04em
    fontFeature: "'tnum' 1"
rounded:
  none: 0px
  xs: 2px
  sm: 4px
  md: 14px
  lg: 16px
  card: 22px
  pill: 999px
spacing:
  pad-min: 16px
  pad-max: 44px
  gap-6: 6px
  gap-8: 8px
  gap-10: 10px
  gap-12: 12px
  gap-14: 14px
  gap-18: 18px
  gap-24: 24px
  head-offset: 62px
  info-offset: 76px
  lane-min: 380px
  lane-max: 560px
  case-bar: 68px
  case-margin: 48px
  case-column-max: 880px
  touch-min: 44px
components:
  button-gate-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ground}"
    typography: "{typography.button-mono}"
    rounded: "{rounded.pill}"
    padding: 17px 26px 16px
  button-gate:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.button-mono}"
    rounded: "{rounded.pill}"
    padding: 17px 26px 16px
  button-case-study-work:
    backgroundColor: "{colors.area-work}"
    textColor: "{colors.ground}"
    typography: "{typography.action}"
    rounded: "{rounded.pill}"
    padding: 11px 20px 11px 22px
    height: 42px
  button-case-study-systems:
    backgroundColor: "{colors.area-systems}"
    textColor: "{colors.ground}"
    typography: "{typography.action}"
    rounded: "{rounded.pill}"
    padding: 11px 20px 11px 22px
    height: 42px
  button-case-study-research:
    backgroundColor: "{colors.area-research}"
    textColor: "{colors.ground}"
    typography: "{typography.action}"
    rounded: "{rounded.pill}"
    padding: 11px 20px 11px 22px
    height: 42px
  button-case-study-mind:
    backgroundColor: "{colors.area-mind}"
    textColor: "{colors.ground}"
    typography: "{typography.action}"
    rounded: "{rounded.pill}"
    padding: 11px 20px 11px 22px
    height: 42px
  button-case-study-education:
    backgroundColor: "{colors.area-education}"
    textColor: "{colors.ground}"
    typography: "{typography.action}"
    rounded: "{rounded.pill}"
    padding: 11px 20px 11px 22px
    height: 42px
  chip-project:
    backgroundColor: "{colors.scrim-chip}"
    textColor: "{colors.primary}"
    typography: "{typography.chip-mono}"
    rounded: "{rounded.pill}"
    padding: 6px 11px 6px 13px
  hud-toggle:
    backgroundColor: "{colors.glass-hud}"
    textColor: "{colors.primary}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.pill}"
    size: 44px
  kicker:
    backgroundColor: transparent
    textColor: "{colors.ink-dim}"
    typography: "{typography.label-mono}"
  title-block:
    backgroundColor: "{colors.scrim}"
    textColor: "{colors.primary}"
    typography: "{typography.display-title}"
  stops-panel:
    backgroundColor: "{colors.scrim-panel}"
    textColor: "{colors.primary}"
    rounded: "{rounded.none}"
  row-rule:
    backgroundColor: "{colors.hair-soft}"
    height: 1px
  gate-outline:
    backgroundColor: "{colors.hair}"
    height: 2px
  hero-name:
    backgroundColor: transparent
    textColor: "{colors.hero-ivory}"
    typography: "{typography.display-hero}"
  cursor-ring:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    size: 30px
  skip-link:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ground}"
    typography: "{typography.label-mono}"
    padding: 10px 14px
  case-frame:
    backgroundColor: "{colors.case-paper}"
    textColor: "{colors.case-ink}"
    typography: "{typography.body-md}"
  case-name:
    backgroundColor: transparent
    textColor: "{colors.case-ink}"
    typography: "{typography.display-case}"
  case-selection:
    backgroundColor: "{colors.case-accent-default}"
    textColor: "{colors.case-paper}"
  finale-card:
    textColor: "{colors.primary}"
    rounded: "{rounded.card}"
---

<!-- Visual contract for Metamorphoses v4, promoted 2026-10-11. Derived from the shipped build (code at 05f9aea, docs at 2d0aeff), not from intentions. Evidence is cited as file:line against commit 2d0aeff; later src/ edits shift it, so re-check a line before acting on it.
     Lint after every edit: npm run design:lint (pinned @google/design.md 0.4.0; 0 errors and 0 warnings required). Fluid sizes stay as px maxima in the front matter; clamp() there fails the lint.
     Tool status (levels L0-L4, BLOCKED, CANDIDATE) lives in TOOLCHAIN.md. History of this file: docs/toolchain/awesome-design-md.md. -->

# Design System: Metamorphoses

## Overview

**Creative North Star: "Changed forms on a black sky"** (provisional: proposed from the site's Ovid line, Metamorphoses 1.1; Joseph confirms or replaces it. Alternatives: `docs/toolchain/awesome-design-md.md` section 8.)

The site is one continuous camera flight through a single particle world. A central orb TV sits at the hub; six areas (Work, Systems, Research, Second Brain, Education, About) surround it; 28 waypoints run from a prologue cloud to a contact finale. One gesture moves the camera one waypoint. The page itself is a tall scroll spacer (`index.html:27`); everything visible is a fixed canvas (`#field`) plus fixed DOM layers for copy, HUD, cursor and dialogs.

The interface behaves like a museum label beside a lit object. Chrome is ivory ink, hairlines and dark scrims; it never carries hue of its own. Colour comes from the 3D forms and from one accent per area, so each part of the world reads as its own room. The canvas is near-black (#050506), close to the black of the dark-luxury references (Bugatti, Lamborghini, SpaceX) but with saturated native colour in the content where those sites have photography.

Type is editorial. A high-contrast Didone (Bodoni Moda) carries uppercase titles and numerals at monumental size; Instrument Serif italic carries the voice (claims, ledes, list titles); Archivo carries reading; IBM Plex Mono carries every label, button and figure. The pairing is a three-role split, like Bugatti's Display / Text / Monospace trinity, with a second serif added for the narrative voice.

**Key Characteristics:**
- Near-black ground (#050506) under every surface; black stays black (measured, see 3D & Asset Pipeline).
- Ivory ink (#EDE6D6) is the only chrome colour; hairlines are the same ink at 34% and 16%.
- Five area accents plus ivory for About; an accent appears on numerals, rules, the primary action and drag states, never as a panel fill.
- Uppercase Bodoni Moda titles fitted to the copy lane (28px to 20vh), optical size 44, a 0.4px stroke to keep hairlines alive over bloom.
- Mono uppercase labels at 0.10 to 0.14em tracking for all navigation and buttons.
- Pills for actions, square glass panels for dense lists, circles for dots and the cursor ring.
- The native cursor is never hidden; a decorative ring follows it.

## Colors

The palette is one ivory ink on near-black, plus one native accent per area. Hue belongs to the world, not to the chrome.

### Primary
- **Ivory Ink** (#EDE6D6): all chrome type, the primary gate button fill, focus outlines, selection, the cursor ring. In CSS it is both `--ink` and `--accent` (`src/v3/styles/tokens.css:4-5`); the critical-paint style and favicon repeat it (`index.html:9,12`).

### Secondary (area accents, applied at runtime as `--a`)
Set per stop by `src/v3/ui/overlays.ts:101` from `src/v3/ui/copy.ts:84-89`.
- **Work Violet** (#B48CFF): Area I, Built for Others.
- **Systems Vermilion** (#FF4A2B): Area II, Left Running; also the epilogue accent (`copy.ts:264`).
- **Research Rose** (#FF6A8A): Area III, The Hidden Grammar.
- **Mind Blue** (#8FB8FF): Area IV, Where the Mind Leads.
- **Education Gold** (#D9A441): Area V, University of Chicago.
- About, prologue, name and world stops use Ivory Ink as their accent (`copy.ts:89,256,260`; the prologue's comes from `src/v3/chapters.ts:21` via `copy.ts:253`).

Each case view takes its own project accent from the reel definition (`src/ui/case.ts:352`); 24 distinct project accents exist in `src/reels/` (warm oranges, ambers, violets, blues, greens).

### Neutral
- **Night Ground** (#050506): page, canvas clear, loader, theme-color (`tokens.css:3`, `index.html:8,12-14`).
- **Dim Ink** (ivory at 74%): kickers, metadata, secondary lines (`tokens.css:8`).
- **Hairline** (ivory at 34%): button and toggle outlines (`tokens.css:6`).
- **Soft Hairline** (ivory at 16%): list rules, panel borders (`tokens.css:7`).
- **Title Scrim** (ground at 62% fading to 0): radial scrim behind title blocks (`src/v3/styles/overlays.css:78-82`).
- **Panel Scrim** (ground at 78%): the stops panel and tooltips, with blur (`overlays.css:244`, `src/v3/styles/nav.css:76`).
- **Chip Scrim** (ground at 50%): behind outlined actions so they read over bloom (`overlays.css:119`).
- **Hero Ivory** (#FFF6DE, `rgb(255,246,222)`): the hero name's letter plane over the particle name (`overlays.css:71`).

### Case-view palette (legacy, still shipped)
- **Case Paper** (#0E0F10) and **Case Ink** (#ECEAE3): set on `.cv-hero` (`src/styles/case.css:146`) and used as fallbacks across `case.css` (40 and 24 literal uses there; 46 and 25 across the live stylesheets once `src/ui/fx/fx.css` is counted). They come from the v2 NIGHT palette (`src/theme.ts:8`). See Known Gaps 1.
- **Case Accent Default** (#FF6A4D): `--acc` before a project accent is applied (`case.css:3,8`); selection fill (`case.css:31`).

### Named Rules
**The Colour Lives in the World Rule.** Chrome stays ivory, black and transparent. Hue enters only through the 3D forms, the area accent and project accents.

**The Black Stays Black Rule.** No milky wash, haze lift or desaturating grade over the scene. `scripts/grade-check.mjs` (a manual script against a running server, not part of `npm run build`) fails when saturation drops below 0.95 of baseline or sky black rises above luma 0.03.

**The One Accent per Room Rule.** A stop shows its own area accent and no other. The accent marks numerals, rules, the primary action and active states; it never fills a panel.

## Typography

**Display Font:** Bodoni Moda Variable (fallbacks Bodoni 72, Didot, Times New Roman), weights 400 to 900, optical size axis (`@fontsource-variable/bodoni-moda/opsz.css`, imported at `src/v3/main.ts:7-8`).
**Voice Font:** Instrument Serif 400, roman and italic (`src/v3/main.ts:9-10`); almost always set italic.
**Body Font:** Archivo Variable with width axis 62 to 125 (`src/v3/main.ts:11`).
**Label / Mono Font:** IBM Plex Mono 400 and 500 (`src/v3/main.ts:12-13`), 600 loaded with the case view (`src/ui/case.ts:11`).

**Character:** A sharp Didone for monuments, a soft italic serif for the speaking voice, a variable grotesque for reading, a mono for instruments. Newsreader and Martian Mono are installed but not used (Known Gaps 3).

### Hierarchy
Front-matter sizes are the maximum of each fluid range. The shipped formulas:
- **Display Title** (Bodoni Moda 640, uppercase, fitted by JS between 28px and 20vh on desktop, `min(13vh, 20vw)` on phones, 2px steps; line-height 0.9; -0.015em; `opsz` 44; 0.4px text stroke): every stop title (`overlays.css:36-41`, `src/v3/ui/overlays.ts:300-329`).
- **Display Index** (Bodoni Moda 600, `clamp(48px, 8vw, 148px)`, 0.82, -0.02em, `opsz` 96, uppercase): the Index dialog heading (`overlays.css:296`).
- **Display Stat** (Bodoni Moda 640, `clamp(64px, 14vh, 150px)` for beats and `clamp(64px, 14vh, 140px)` for stats, 0.85, -0.03em, in the area accent) (`overlays.css:231,238`).
- **Display Name** (Bodoni Moda 640, `clamp(44px, 5vw, 76px)`, 0.98): "Joseph Blumberg" on the prologue (`overlays.css:174`).
- **Display Hero** (Bodoni Moda 900, optical sizing auto, size set by a live homography over the particle name, Hero Ivory fill with a 1.25px stroke): the name on the cosmos (`overlays.css:69-73`).
- **Display Case** (Archivo 800, 0.9, width fitted from 125 down to 62.5 with tracking -0.008 to -0.036em, size fitted by JS): case-view project names (`case.css:182`, `src/ui/case.ts:97-123,656-658`).
- **Claim Italic** (Instrument Serif italic, `clamp(28px, 4.2vw, 70px)`, 1.02): the claim under the name (`overlays.css:189`); the loader's Ovid line uses `clamp(26px, 4.6vw, 74px)`/1.04 (`tokens.css:68`); the prologue's Ovid line `clamp(28px, 3vw, 44px)`/1.12, 30px on phones (`overlays.css:168`, wave-22 #23).
- **Lede Italic** (Instrument Serif italic, `clamp(21px, 1.75vw, 28px)`, 1.22): stop ledes (`overlays.css:105`).
- **Title Italic** (Instrument Serif italic, `clamp(20px, 1.7vw, 26px)`, 1.1): table-of-contents rows, menu names (`overlays.css:203`, `nav.css:119`).
- **Body Large** (Archivo 400, `clamp(17px, 1.35vw, 21px)`, 1.5, width 96%): stop body copy, max lane 560px (`overlays.css:104`).
- **Body** (Archivo 400, 17px, 1.55): document default (`tokens.css:41`).
- **Body Strong** (Archivo 500, `clamp(15px, 1.1vw, 17px)`, 1.4): the plain "what it is" line on project cards (`overlays.css:135`).
- **Action** (Archivo 600, 14.5px, sentence case): "Open case study" and first-screen actions at 15px (`overlays.css:142,144`).
- **Label Mono** (Plex Mono 500, 11.5px, 1.35, 0.13em, uppercase): kickers, nav, captions (`tokens.css:50`, `nav.css:9`).
- **Button Mono** (Plex Mono 500, 13px, 0.14em, uppercase): entry gate buttons (`tokens.css:93`).
- **Chip Mono** (Plex Mono 500, 11px, 0.1em): secondary chips (`overlays.css:148`).
- **Figure Mono** (Plex Mono 500, `clamp(34px, 3.9vw, 64px)`, 0.95, -0.05em, tabular): project figures in the accent (`overlays.css:109`).
- **Counter Mono** (Plex Mono 500, `clamp(54px, 9vw, 150px)`, 0.8, -0.04em, tabular): loader percent (`tokens.css:79`).

### Named Rules
**The Two Serifs Rule.** Bodoni Moda speaks in uppercase monuments and numerals; Instrument Serif speaks in italic sentences. Do not set Bodoni in sentence-case body or Instrument Serif in uppercase.

**The Instrument Label Rule.** Every button, nav item, kicker and figure label is Plex Mono, uppercase, tracked 0.10 to 0.14em. The exceptions are the three sentence-case action strings the brief names ("Start", "Watch the tour", "Open case study"), set in Archivo 600 (`overlays.css:143-144`).

**The Living Hairline Rule.** Bodoni at display size keeps `opsz` 44 (96 only for the Index heading) and a 0.4px stroke with `paint-order: stroke fill`, because the thin strokes drop out over a grain field at 1x.

## Layout

The layout is a full-viewport stage with copy lanes at its edges, not a grid. The canvas fills the screen (`#field`, `tokens.css:58`); copy panels are absolutely placed in a lane on the left or right of the subject (`data-side`), and centred only for the prologue and name.

- **Edge padding:** `clamp(16px, 2.6vw, 44px)` (`--pad`, `tokens.css:14`).
- **Copy lane:** desktop `clamp(380px, 31vw, 560px)`; phones full width minus `max(16px, 4vw)` per side (`overlays.ts:300`). Some stops cap the lane so it never covers art (`LANE_CAP`, `overlays.ts:302-303`).
- **Vertical anchors:** title block at `pad + 62px` from the top; info block at `pad + 76px` from the bottom (`overlays.css:15,87`).
- **Case view:** 68px top bar, 48px side margin, text column `min(56vw - 48px, 860px)`, 880px from 1400px wide (`case.css:9-11,23`).
- **Observed gap rhythm:** 8px and 10px dominate (30 and 29 uses), then 12px, 14px, 6px, 16px, 18px, 24px. There is no named spacing scale in CSS.
- **Viewport height:** `--vh` is replaced by a px value in JS so mobile URL bars never shift layout (`tokens.css:13`).
- **Layers:** field 0, overlays 40, index 45, anchors 50, HUD 60, skip link 300, loader 400, cursor 450 (`tokens.css:19-26`).

### Responsive behaviour
- **Primary breakpoint 760 / 761px** (15 `max-width: 760px` queries, 6 `min-width: 761px`): phone layout, full-width lanes, smaller fixed sizes (lede 20px, figure 34px, name 44px), education rows fold (`overlays.css:339-404`).
- **Secondary breakpoint 899 / 900px** (5 rules): Overview and menu layouts.
- **Short screens:** `max-height: 760px` tightens lede 21px, figure 34px, body 17px on desktop (`overlays.css:408-412`).
- **Portrait:** `(max-width: 760px), (orientation: portrait)` and `max-aspect-ratio: 1/1` variants fold secondary rows.
- **Touch:** `(pointer: coarse)` raises every action to 44px minimum (`overlays.css:407`); hover effects only under `(hover: hover) and (pointer: fine)` (11 rules).

### Named Rules
**The Lane Rule.** Copy lives in a lane at the edge; titles sit at the lane edge and never over the subject (`overlays.css:1-3`).

## Elevation & Depth

Depth comes from the 3D scene: camera parallax, bloom on hot cores, the star field and the hall's mirrored floor. The DOM layer is flat and uses three devices to stay legible over a bright scene: radial dark scrims, text shadows in the ground colour, and frosted glass for dense panels.

- **Radial scrims** behind titles (ground 62% to 40% to 0) and info blocks (86% to 70% to 0) (`overlays.css:78-97`).
- **Ground-colour text shadow** on every overlay line, for example `0 0 32px rgba(5,5,6,.85), 0 2px 5px rgba(5,5,6,.45)` on titles (`overlays.css:34`). Never a coloured glow.
- **Frosted glass** (`backdrop-filter: blur()`), eight radii in use: 6px (HUD toggles, tooltips), 8px (stops panel, hall chips), 10px (Overview bar, case captions), 12px (case glass, `case.css:121,348`), 14px (menus, autoplay, case dialogs), 16px and 18px (menu sheet, Overview, case lightbox), 22px (finale card). Saturation 0.8 to 1.3.
- **Real shadows** appear only on floating 3D-adjacent objects: the record crate (`0 30px 70px -30px #000`, `src/v3/styles/crate.css:9`), the finale card (`0 30px 80px rgba(0,0,0,.55)`, `src/v3/styles/finale.css:31`) and case-view media lit by the project accent (`case.css:438`).

### Named Rules
**The Scrim, Not Box Rule.** Copy over the world gets a radial scrim and a ground-coloured shadow, not a card. Glass panels are for lists and controls only.

## Shapes

Shape follows function: round for things you press, square for things you read.

- **Pill** (999px): every action button, chip, HUD toggle, gate button (21 uses; `tokens.css:92`, `overlays.css:117`).
- **Circle** (50%): dots, list bullets, the cursor ring (31 uses; `src/v3/styles/hud.css:134`).
- **Square** (0px): the desktop stops panel (`overlays.css:245`).
- **Small** (2px and 4px): keyboard hints (`kbd`), focus rings in the case view, thin bars (19 uses).
- **Soft card** (14px, 16px, 20px, 22px): case-view captions and on-screen notes, the record crate, the finale card.

## Components

### Buttons
- **Gate primary** ("Enter with sound"): ivory fill, ground text, Button Mono, pill, 17px 26px 16px padding (`tokens.css:91-96`). Hover lifts 2px and nudges the arrow 5px (`tokens.css:100-104`).
- **Gate secondary** ("Enter silently"): transparent with a 2px hairline outline, ivory text; hover fills ivory at 12% (`tokens.css:92,102`).
- **Open case study** (project card primary): filled with the area accent, ground text, Archivo 600 14.5px, sentence case, 42px tall (44px on touch) (`overlays.css:140-142,368`). Hover brightens 1.14 (`overlays.css:157`).
- **Outlined action** (`.open`): 1.5px outline in the accent at 72%, Chip Scrim fill, Label Mono; hover wipes the accent up from the bottom in 0.4s (`overlays.css:115-131`).
- **Secondary link** (`.sec`): 12.5px mono label at full ivory ink with a 1.5px underline in the accent at 88% (`overlays.css` `.sec`). The repo link, **Source code**, is the one secondary drawn as a hairline pill in the accent at 72% (`.sec[data-kind="code"]`); it stays lighter than the filled Open case study button. A reading instrument's repo leads its row.

### Chips
- **Project chip:** 1px outline in the accent at 46%, 6px 11px 6px 13px, Chip Mono, pill (`overlays.css:148`); 40px tall on phones.

### Cards / Containers
- **Project card** (`.pcard`): no box. Name in the accent with a 22px rule, plain type line in Dim Ink, one sentence, one figure, then actions (`overlays.css:133-145`).
- **Stops panel** (desktop): Panel Scrim, 8px blur, Soft Hairline border, square corners (`overlays.css:242-245`).
- **Finale contact card:** ivory-tinted gradient over `rgba(8,9,13,.46)`, 22px blur, 22px radius, `min(460px, 38vw)` wide (`finale.css:25-32`).
- **Record crate:** warm glass tray with one amber accent (`rgba(241,160,90,.22)` border), 20px radius, 18px blur (`crate.css:1-9`).

### Navigation
- **HUD:** identity link (Instrument Serif italic "Joseph Blumberg", mono "Portfolio · 2026"), a rail of waypoint ticks, sound and pause toggles, a next-stop button (`src/v3/ui/hud.ts:49-90`). Toggles are pill glass at 52% ground with a 6px blur (`hud.css:37`).
- **Keyboard:** O Overview, M Index, T tour, C contact (`docs/DESIGN-STATE.md:54`). Keyboard hints render as 4px-radius `kbd` boxes (`nav.css:17,125`).
- **Index rows:** accent underline grows from the left in 0.55s on hover or focus; name and numeral slide 12px (`overlays.css:306-314`).

### Cursor ring (signature)
A decorative 30px ring, 2px ivory border with a dark halo, following the native cursor with inertia. It lives in the top layer (popover) above dialogs. It grows to 1.7x on interactive elements, 2.2x over pressable TVs, opens into two arcs "( )" over draggable space, and closes up in the accent while dragging (`src/v3/ui/cursor.ts:1-6,42`, `hud.css:128-142`). Hidden on touch.

### Case view (signature)
A full-screen dialog that grows out of the TV screen. Case Paper ground, Case Ink type, a GPU ink field in the project accent behind the header (`case.ts:643-644`), the project name in Display Case split into letters by anime.js `splitText` (`case.ts:668`), evidence walls and page-flip books with grab cursors (`case.css:315-366`).

## Do's and Don'ts

### Do:
- **Do** keep the ground at #050506 and the chrome in Ivory Ink (#EDE6D6) with 34% and 16% hairlines.
- **Do** let each stop use only its own area accent (`--a`), on numerals, rules, the primary action and active states.
- **Do** set titles in uppercase Bodoni Moda 640 with `opsz` 44 and the 0.4px stroke; fit size to the lane, never to a fixed px value.
- **Do** set voice lines (claims, ledes, list titles) in Instrument Serif italic, and every label and button in Plex Mono uppercase at 0.10 to 0.14em.
- **Do** put a radial ground scrim and ground-coloured text shadow behind copy that sits over the scene.
- **Do** give every action a 44px minimum touch target under `(pointer: coarse)`, and gate hover effects behind `(hover: hover) and (pointer: fine)`.
- **Do** provide a reduced-motion path: `html.rm` and `prefers-reduced-motion` drop translation and keep 0.35s opacity fades (`overlays.css:329-335`).
- **Do** put the name on the cosmos (Milky Way and nebula) with no hanging TV behind it (`scripts/grade-check.mjs` check 4).
- **Do** reach for a pre-built asset or component first (Poly Haven, ambientCG, sitereel, 21st, VengeanceUI by port) and say what was searched before writing a shader or procedural mesh.

### Don't:
- **Don't** add a grade, wash, tint or haze that lowers saturation or lifts black; grade-check fails it.
- **Don't** fill panels with accent colour or give chrome a hue of its own.
- **Don't** hide the native cursor (`cursor: none` appears nowhere in `src/`; keep it that way). No pointer lock either: it hides the cursor.
- **Don't** let a title cross the subject; titles sit at the lane edge.
- **Don't** set body copy in Bodoni or labels in a serif.
- **Don't** use chrome or metallic treatments on the name (the chrome version was judged "rapper jewelry", `docs/DESIGN-STATE.md:26`).
- **Don't** blend overlay type into the scene (`mix-blend-mode` on copy); type uses normal blend and solid ink (`overlays.css:2`).
- **Don't** caption the gothic hall as a UChicago building unless it was built from Joseph's own capture of one.

## Motion & Interaction

Extension section (not in the Google spec). Motion values cannot live in the front matter; impeccable's sidecar carries them as tokens.

- **Named easings** (`tokens.css:15-17`): `--ease-out` `cubic-bezier(0.16, 1, 0.3, 1)` for arrivals; `--ease-io` `cubic-bezier(0.65, 0, 0.35, 1)` for exits and jumps; `--ease-fly` `cubic-bezier(0.22, 1, 0.36, 1)` for camera-linked UI. The case view also uses an untokenised `cubic-bezier(.2, .9, .3, 1)`: 16 times in `case.css`, 23 times across all live code (lab stylesheets, `case.ts`, `annotate.css`) (Known Gaps 4).
- **Durations in use:** 0.25s (57 uses) and 0.3s (39) for colour and border; 0.35s to 0.55s for slides and underlines; 0.6s to 0.9s for loader and gate reveals.
- **Overlay rhythm:** info pieces arrive in 520ms with a 70ms stagger and leave in 180ms with a 40ms stagger (`overlays.css:99-100`); titles scrub with the camera leg.
- **Camera legs:** one gesture = one waypoint. Ordinary legs run 1.35 to 1.95s by travel distance; authored set pieces (the gothic doors) run longer except on phones and reduced motion (`src/v3/world/flight.ts:223-231`).
- **Libraries:** anime.js 4.5 in 27 files of the live v3 bundle (`animate`, `stagger`, `scrambleText`, `createTimeline`, `splitText`, `svg`); Motion 14 in 4 live files (`src/ui/case.ts` and the labs `chomchom.ts`, `notebooklm-study-loop.ts`, `recruiting-os.ts`). The totals of 31 and 8 count the v2 entry and dead files too (v2 only: `src/main.ts`, `src/ui/boot.ts`, `works.ts`, `offboard.ts`; dead: `desk.ts`). Prefer anime.js text and SVG utilities over hand-written tweens, and give each element one animation owner (never anime and Motion on the same element).
- **Reduced motion and cleanup:** reduced motion reads `isRm()` (`src/v3/ui/util.ts:54`, the `html.rm` class) in every call site. anime's `createScope` is for new labs and components only, because a scope's media query misses the site's own reduced-motion toggle; existing code is not refactored onto it.
- **Morph text** (wave-22 #23, `src/v3/ui/morph.ts`, ported from VengeanceUI morph-text, MIT): the prologue's Ovid line melts into its English and back. Holds 5.6s / 5.2s, morphs 1.8s ease-in-out; the threshold filter and the blur keyframes exist only during a morph. It stops for reduced motion (static Latin over its translation), for Pause, and while the camera leaves the stop.
- **Drag:** grab and grabbing cursors on draggable stages (crate, evidence wall, book) (`crate.css:29-34`, `case.css:315-366`).

## 3D & Asset Pipeline

Extension section. This is where the site's visual quality is decided; the chrome above only frames it.

### Rendering invariants (shipped)
- **Engine:** three@0.186, vanilla TypeScript, no React, R3F or drei (`package.json:22`). WebGL only: three's native splat loader needs `WebGPURenderer`, which the site never creates.
- **Post chain:** RenderPass into a HalfFloat target with depth, then UnrealBloomPass, then one final pass (`src/v3/engine/post.ts:2,455`). Shipped settings: bloom strength 0.62, threshold 0.78, knee 0.75, radius 0.7; grain 0.01; vignette 0.36; exposure 1.0; output limit 0.972 (`post.ts:378-386`).
- **Display-referred colour:** the final pass writes material output straight to the sRGB canvas with no extra transfer function (`post.ts:23-25`). Anything imported must already be display-referred: wrap materials with `displayReferred()` (`src/v3/world/tvset.ts:23`), and run baked atlases and backdrops through the hue-preserving shoulder in `scripts/hdri-prep.mjs`.
- **Colour guard:** `node scripts/grade-check.mjs --url <dev url>` checks grade looks (saturation >= 1, zero lift, film <= 0.3), saturation per stop >= 0.95 of baseline, hue histogram shape, sky black p5 luma <= 0.03, and the cosmos name screen (`scripts/grade-check.mjs:1-17`).

### Rendering rules (targets, NOT yet met by shipped code)
- **No GPU read-backs while a leg flies.** About 30 synchronous read-backs per second (exposure and particle meters, hub TV light) were the measured cause of the wide-view frame drops; switching them off cut long tasks 41 to 5 over 8 legs (`docs/HANDOFF.md:77`, `docs/DESIGN-STATE.md:71`). All three still ship: `src/v3/engine/post.ts:615` (every third frame), `src/v3/engine/field.ts:270`, `src/v3/world/objects.ts:805` (about 6 per second). Three autopilot patches in `~/.claude/autopilot/patches/` address this and the first-flight shader stalls (read-back hold: long tasks 14 to 6; light count: 5 to 0.75; late warm-ups: mid-flight programs 6-8 to 1). They are unapplied and queued for wave 22 (HANDOFF autopilot notes, 2026-10-11). See Known Gaps 9.
- **Budgets for a new environment stop** (from `docs/toolchain/blender-3d-stack.md` section 4.3): crag at `hold` at most 6 MB download, 350k triangles desktop / 150k phone, 12 draw calls, 48 MB GPU textures, 2 new shader programs; hall at most 8 MB, 400k / 200k, 20 calls, 64 MB, 3 programs. Both add **0** GPU read-backs and **0** dynamic lights (light is baked), and the flights in and out must not gain long tasks.

### Asset sources, in order of preference
World Labs Pro (Marble) was dropped on 2026-10-10. Its replacement is Blender (Cycles on Metal) + Poly Haven + ambientCG + SuperSplat + three.js. Baked photoscans are the primary path for the crag (`hold`, stop 23) and the hall (stop 22). The hall is a generic gothic hall unless Joseph supplies a capture of a real one; its copy says "A long hall with five windows" (`src/v3/ui/copy.ts:125`), and it is never called UChicago without that capture.

1. **Poly Haven** (CC0 models, HDRIs, textures; `https://api.polyhaven.com/assets?t=models`, then `/files/<id>`, with a unique User-Agent). Shipped: Namaqualand Boulder 03 (563,012 bytes, Draco) and Kiara 9 Dusk HDRI (`src/data/credits.json`, `public/models/glb/namaqualand-boulder-03.glb`, `public/media/hdri/kiara_9_dusk-{backdrop,env}.webp`).
2. **ambientCG** (CC0 PBR materials, API v3 `https://ambientcg.com/api/v3/assets?type=material&q=<words>&include=downloads`) for surfaces Poly Haven lacks. Not shipped yet. Its zips include `.blend` files: never open one with autoexec.
3. **Sketchfab, CC BY only** (gothic interior kit, real vault scans). Blocked: downloads need Joseph's login (the API returns 401 without a token). CC BY requires title, author, licence and link in `src/data/credits.json`.
4. **Blender 5.2.2 headless** for everything that ships: `/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/<name>.py -- <args>` (boulder_prep, chess, crag, hub_tv, room, turntable, games, shared `lib.py`). Cycles on Metal works headless (6 of 6 runs; 4.2x faster than CPU on a render); the old "Metal HANGS headless" comments in `lib.py` and `crag.py` were corrected on 2026-10-12 and both now bake on Metal through `scripts/blender/m5_preset.py`. Proven chain: Poly Haven photoscan, decimate to budget, lightmap UV, Cycles Metal diffuse bake at 2048², display-referred atlas, Draco GLB, in 8.1 s (829 KB for an 80k-triangle cliff). Set the device inside each script, not in preferences.
5. **Blender MCP** (official Blender Lab server, registered at user scope as `blender`; launcher `~/.local/bin/blender-mcp`; source vendored at `~/.agents/vendor/blender_mcp` @ `dbbf836`, GPL-3.0-or-later). Three ways to drive it:

   | Mode | Start | Use it for |
   |---|---|---|
   | GUI bridge | `open -a Blender` (add-on listens on `localhost:9876`; port up in 1.87 s) | working with Joseph watching; window screenshots and `jump_to_*` tools |
   | Headless bridge | `Blender --background [file.blend] --online-mode --command blender_mcp --port <p>` (port up in 0.57 s, thumbnails in 0.29 s) | unattended multi-step sessions that need state; never with `--factory-startup` |
   | `_for_cli` tools | nothing to start: each call runs `Blender --background <file.blend>` with a 120 s limit | one-off inspection or a short edit of a `.blend`; no state between calls |

   Docs lookups (`search_api_docs`, `get_python_api_docs`, `search_manual_docs`) need no running Blender. Rules: pass `--online-mode` in unattended runs (with "Allow Online Access" off the add-on refuses to start); `render_thumbnail_to_path` and `render_viewport_to_path` ignore the directory you pass and write to Blender's temp folder (`bpy.app.tempdir/blender_mcp/`), so copy the file out before quitting; one Blender process at a time; an agent may launch the GUI or a headless bridge and quits only an instance it launched (check `pgrep -x Blender` first), and never touches a Blender Joseph opened; whatever is worked out through the MCP goes back into a `scripts/blender/` script before anything is exported to `public/`. The socket has no authentication and is bound to localhost.
6. **gltfpack 1.3** (proposed, not vendored): quantised meshopt + KTX2 textures, needed before a full-360 sky (about 100.7 MB of GPU memory as WebP vs 25.2 MB as KTX2 for the crag set). It cannot read Draco: feed it a second, uncompressed Blender export. AXE gate first.
7. **Splats: SuperSplat** (browser editor: crop, clean, compress), **splat-transform** (PLY to SOG/SPZ) and **Spark 2.3.1** (`@sparkjsdev/spark`, three.js renderer). None is installed. Splats are only for a real capture, and the Spark go/no-go runs only after the read-back fix (T3), because Spark's sort path does its own GPU read-backs.
8. **img2threejs** (skill pinned at `a669e9a`, `~/.claude/skills/img2threejs`): a reference photo to a procedural three.js model, for small props with no CC0 model only. Whether to pilot it for the guitar or chess before trying Poly Haven is Joseph's ruling. Drop-in rules: the file goes in `src/v3/world/extras/sculpt/`, mounted in a cabinet `Stage` (`src/v3/world/extras/cabinet/stage.ts`) with `disposeTree(root)` in `dispose()`, `sharedEnv()` instead of its RoomEnvironment, every material wrapped with `displayReferred()`, and its own renderer, composer and lights deleted.
9. **Spline MCP** (`Spline.app`, `3d_run_code` DSL plus geometry read-back in `scripts/spline/`): GUI-authored scenes from primitives. One live form comes from it: the records turntable (`src/v3/forms/turntable3d.ts`), built from `run_code` primitives after `3d_generate_3d_model` timed out (`turntable3d.ts:3`), and shipped as lit surface points, so none of Spline's materials or lighting reach the site. The rule since 2026-10-10 is no AI 3D generation (`FRONTEND.md:40`). `docs/research/spline.md:18` still lists generation as pipeline step 1; that note predates the rule, the one attempt timed out, generated meshes lose their albedo on read-back (`spline.md:27`), and each run costs Spline credits. Image generation only when Joseph asks.
10. **Generated media (Hugging Face / TRELLIS image to GLB):** blocked on Joseph. Default is to skip it: it is not pre-built, and the image goes to a third party.

### Delivery rules
- **GLB + Draco:** `loadGLB()` creates a new `DRACOLoader` on each call and disposes it in `finally` (`src/v3/world/glbmodel.ts:13-21`); 9 modules import it. `setDecoderConfig` (`:13`) is deprecated in r186 and removed in r194. The Draco decoder is served from `public/draco/`; no CDN.
- Lazy-loaded with a procedural fallback (`?noglb` shows the before); HDRIs as WebP equirect pairs (backdrop + env). KTX2 needs the Basis transcoder in `public/basis/` (missing).
- GitHub Pages serves GLBs gzip-encoded with byte ranges (a ranged GET on the live boulder returned 206).
- Every third-party asset is credited in `src/data/credits.json` with licence and source in the same commit (9 entries today).
- Built files only in the public repo; run `node scripts/deploy/privacy-audit.mjs` before publishing.

### Reference and component connectors
Tool status (level L0 configured · L1 mastered · L2 calibrated here · L3 used in a reviewed work product · L4 shipped live, or a BLOCKED / CANDIDATE / PARKED / RETIRED flag) is owned by `TOOLCHAIN.md` at the repo root; look up the id there before relying on a row. This table only routes. React sources are read and ported to vanilla TS + CSS; nothing here installs React, Tailwind or shadcn, and no `npx <pkg>@<ver>` resolves from npm in unattended work.

| Need | Connector | TOOLCHAIN id | First call / rule |
|---|---|---|---|
| How a reference site did it; build prompts | sitereel MCP (`~/.agents/vendor/sitereel-mcp/server.mjs`) | `sitereel-mcp` | `sitereel_search`, then `sitereel_get {slug, section}`; templates are data |
| Ready-made components and effects to port | 21st MCP (project scope) | `21st-mcp` | `search`, then `get_component` (2 per day free); port the real code; licence per author, Joseph rules before it ships |
| Animated components to port | magicui MCP (`@magicuidesign/mcp` 2.0.0, user scope) | `magicui-mcp` | read `~/.agents/ui-registries/magicui` offline; registration made by another actor, awaiting Joseph's confirmation |
| Text and shader effects | OriginKit MCP (remote, Joseph's key) | `originkit` | `search` is free; `get_component` and `fetch` spend daily copies; nothing ported into shipped code before Joseph's licence ruling |
| DOM components to port (Index search, gooey text, share sheet, player) | VengeanceUI, pinned clone `~/.agents/ui-registries/vengeanceui` @ `87f5a77`, skill `vengeance-ui` | `vengeanceui` | port only (no shadcn in this repo): read `public/r/<name>.json` or `packages/mcp/data/index.json` with `jq`; React 19 + Tailwind, framer-motion in 27 of 70 catalog items and GSAP in 9 (import counts); never `npx vengeanceui` or `npx -y vengeanceui-mcp` (unpublished npm names) |
| Library docs (three, anime.js, Motion, Spark) | Context7 MCP | `context7` | `resolve-library-id`, then `query-docs` |
| Browser QA and screenshots | Playwright via `scripts/lib/browser.mjs` `withBrowser()` | `playwright-lock` | one browser per agent, closed in `finally`; the Playwright MCP is parked (it bypasses the lock) |
| Performance traces with insights (T3 gate) | Chrome DevTools MCP 1.10.1 (proposed, not installed for Claude Code) | `chrome-devtools-mcp` | after Joseph approves: pinned, vendored, telemetry, CrUX and update checks off (`docs/toolchain/mcp-audit.md` section 5) |
| Live Blender | Blender MCP (`blender`) | `blender-mcp` | pick a mode above; `get_objects_summary`, then `render_thumbnail_to_path` (copy out of the temp folder) |
| Anything 3D that ships | Blender headless scripts | `blender-headless` | `Blender -b -P scripts/blender/<name>.py -- <args>` |
| CC0 models, HDRIs, textures | Poly Haven API | `polyhaven` | `assets?t=models`, then `/files/<id>`; credit every asset |
| CC0 materials | ambientCG API v3 | `ambientcg` | `/api/v3/assets?type=material&q=<words>&include=downloads` |
| CC BY gothic kit and vault scans | Sketchfab | `sketchfab` | blocked on Joseph's login; credit is mandatory |
| KTX2 + quantised meshopt | gltfpack 1.3 native (proposed) | `gltfpack` | AXE gate, then `gltfpack -i <uncompressed>.glb -o out.glb -cc -tc` |
| Splat clean, convert, render | SuperSplat, splat-transform, Spark 2.3.1 | `supersplat`, `splat-transform`, `spark` | only for a real capture, after T3 |
| Procedural prop from a photo | img2threejs skill | `img2threejs` | only after Poly Haven has nothing (Joseph's ruling); drop-in rules above |
| 3D editor scenes | Spline MCP | `spline-mcp` | `load_skill("authoring-guide")`, then `run_code` primitives; no AI generation |
| Motion docs and audits | Motion MCP | `motion-mcp` | blocked: pending approval, Joseph approves or removes; meanwhile `~/.claude/skills/motion/` |
| UI anti-pattern lint | impeccable | `impeccable` | `impeccable detect src` (offline launcher `~/.local/bin/impeccable`) |
| DESIGN.md lint | `@google/design.md` 0.4.0 (pinned devDependency) | `design-md-lint` | `npm run design:lint` |

## Agent Prompt Guide

### Quick colour reference
- Ground: Night Ground (#050506)
- Chrome type, outlines, primary button: Ivory Ink (#EDE6D6)
- Secondary text: Ivory Ink at 74%
- Hairlines: Ivory Ink at 34% (outlines), 16% (rules)
- Area accents: Work #B48CFF, Systems #FF4A2B, Research #FF6A8A, Mind #8FB8FF, Education #D9A441, About #EDE6D6
- Case view: paper #0E0F10, ink #ECEAE3, project accent from the reel

### Example prompts
- "Add a copy panel for a new Research stop: left lane `clamp(380px, 31vw, 560px)`, kicker 'III · Research' in Plex Mono 500 11.5px uppercase 0.13em (numeral and dot in #FF6A8A, the word in ivory at 74%), title in uppercase Bodoni Moda 640 `opsz` 44 with a 0.4px stroke fitted to the lane, a lede in Instrument Serif italic `clamp(21px, 1.75vw, 28px)`, body in Archivo 400 at width 96%, then a pill 'Open case study' filled #FF6A8A with #050506 text in Archivo 600 14.5px. Radial ground scrim behind the block, no card."
- "Design a HUD toggle: 44px pill, background #050506 at 52% with a 6px backdrop blur, 1.5px outline in ivory at 34%, Plex Mono 500 12px uppercase 0.13em ivory label; hover only under `(hover: hover) and (pointer: fine)`."
- "Bring a Poly Haven model into a stop: fetch it through the Poly Haven API into its own download directory, write `scripts/blender/<name>.py` (Blender 5.2.2 headless, Cycles on Metal set in the script; the Blender MCP only to inspect), bake the light into a display-referred atlas, export a Draco GLB within the stop budget, lazy-load it as an unlit `MeshBasicMaterial` with the current scene as fallback, credit it in `src/data/credits.json` in the same commit, then run grade-check and confirm saturation and black level pass."

### Iteration guide
1. Work on one stop or one component at a time and name it by its YAML key (`button-case-study-mind`, `chip-project`).
2. Use token names, not raw hex, in new CSS; extend `tokens.css` before adding a literal.
3. Sizes in the front matter are maxima; ship the `clamp()` formulas from Typography.
4. Pre-built first: search sitereel, 21st, VengeanceUI, Poly Haven and ambientCG before writing a shader or procedural mesh, and say what was searched.
5. Run `taste-skill` before and `impeccable critique` after any UI pass, then `impeccable detect src` through the installed offline launcher (`~/.local/bin/impeccable`; not `npx`, which fetches from npm). The baseline exits 2 (Known Gaps 10); a pass must not add findings.
6. Every change to the scene ends with `node scripts/grade-check.mjs` and `node scripts/proofread.mjs "<url>/?gate=0"` passing.
7. After editing this file, `npm run design:lint` must report 0 errors and 0 warnings. Never put `clamp()` in the front matter: the linter rejects it in `typography` and silently drops it from `spacing`.

## Known Gaps

1. **Two grounds and two inks.** The world uses #050506 / #EDE6D6 (`tokens.css:3-4`); the case view uses #0E0F10 / #ECEAE3 (`case.css:146`, from `src/theme.ts:8`). Decide whether the case view should move to the world tokens (needs Joseph).
2. **Two display voices.** World titles are uppercase Bodoni Moda; case-view names are Archivo 800 sentence case. Decide whether this split is intended (needs Joseph).
3. **Unused fonts.** `@fontsource-variable/newsreader` and `@fontsource-variable/martian-mono` are dependencies (`package.json:16-17`) but are imported nowhere in `src/`.
4. **Untokenised motion.** `cubic-bezier(.2, .9, .3, 1)` is written out 23 times across live code (16 in `case.css`); there is no duration scale.
5. **Glass has no scale.** Eight blur radii (6 to 22px) and saturation from 0.8 to 1.3. The 0.85 saturate on the menu sheet and Overview (`nav.css:100`, `overview.css:9`) and 0.8 on the case lightbox (`case.css:436`) slightly desaturate what is behind those panels.
6. **Breakpoint sprawl.** 760/761 and 899/900 carry the system, plus about 13 one-off queries.
7. **Stale comment.** `case.css:1-2` says colours come from `base.css`, which v4 does not load.
8. **No PRODUCT.md and no `.impeccable/design.json` yet.** Run `/impeccable init`, then `/impeccable document` (merge mode) to generate the sidecar from this file. `document` must keep px maxima in the front matter, or the lint gate fails.
9. **GPU read-backs still ship.** The no-read-back rule in 3D & Asset Pipeline is not met: `post.ts:615`, `field.ts:270` and `objects.ts:805` still call `readRenderTargetPixelsAsync` during the flight (DESIGN-STATE flaw 4). The autopilot's three patches are unapplied (wave 22).
10. **The impeccable gate starts red.** `impeccable detect src` exits 2 (baseline 2026-10-11): 2 `layout-transition` anti-patterns at `src/ui/labs/cloudflare.css:55` and `src/v3/world/extras/hall/hall.css:14`, plus 1 advisory (`src/ui/fx/fx.css:35`, grid-line background). With this file in the repo, detect also reports 798 design-system advisories (571 colour, 144 radius, 83 font-size; 799 advisories in all). The gate compares anti-patterns (`impeccable detect --no-advisory src`).
11. **Blender comments (fixed 2026-10-12).** `scripts/blender/lib.py` and `crag.py` said Metal hangs headless and forced the CPU; it did not reproduce in 6 of 6 runs. Both now bake on Metal through `m5_preset.apply_bake` (`M5_DEVICE=cpu` forces the CPU); see `docs/toolchain/blender-m5-audit.md`.
12. **Other docs may still route the crag and hall through World Labs / Marble.** Where they disagree with this file and `TOOLCHAIN.md`, these two win.

### Open decisions (Joseph's rulings; recorded here, not decided)
- the final Creative North Star
- case-view token unification (Known Gaps 1–2)
- hall capture (generic gothic vs a real UChicago capture)
- Hugging Face / TRELLIS image→GLB
- OriginKit and 21st licence rulings for shipped code
- Motion MCP approve/remove
- the svelte and magicui MCP registrations made by another actor
- img2threejs pilot vs Poly Haven for guitar/chess
- P1 (port case.ts Motion calls to anime)
- shorter particle motion streaks in `src/v3/engine/compose.ts` (clears the remaining GPU-bound stretch on the first name → world flight, but changes the look; HANDOFF autopilot note, 2026-10-11 13:16)
- committing or publishing anything (this file included)
