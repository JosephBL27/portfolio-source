# Joseph Blumberg: portfolio source

The source of [josephbl27.github.io](https://josephbl27.github.io/): one flight through 28 stops, with a case study for each of 23 projects.
Every case opens directly at `https://josephbl27.github.io/#<project>` (for example [#love-island](https://josephbl27.github.io/#love-island)).

**Stack.** Vanilla TypeScript and Vite, three.js r186 (WebGL), anime.js 4 for the interface and the mechanical pieces, Motion in the case views,
and Blender 5.2 run headless for the baked models (`scripts/blender/`). No framework, no CSS library. The visual system is in `DESIGN.md`.

**Run it.**

```bash
npm install
npx vite --port 5490
```

**Checks** (each drives a real browser through `scripts/lib/browser.mjs`): `scripts/proofread.mjs` traces every numeral on the page to `src/data`,
`scripts/grade-check.mjs` holds native colour on deep black, `scripts/deeplink-check.mjs` opens every project link,
`scripts/model-check.mjs` loads every model. A privacy audit (kept private) runs before every publish.

Credits for every third-party asset and code port are in `src/data/credits.json` and shown on the site.
