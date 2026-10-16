// The one place that knows where the portfolio lives. A project's canonical link is LIVE_URL + '#' + its id from src/data/projects.json;
// src/v3/ui/nav.ts resolves it (fresh load and hashchange), the case view's Copy link control copies it, docs/LINKS.md lists it and
// scripts/deeplink-check.mjs asserts all three. Not the page's own origin: a link copied on localhost or a preview must still be the public one.
export const LIVE_URL = 'https://josephbl27.github.io/'
export const projectLink = (id: string): string => `${LIVE_URL}#${id}`
