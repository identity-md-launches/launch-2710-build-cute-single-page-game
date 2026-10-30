// Regenerates public/favicon.svg and public/og.png from the hamster sprite.
// Usage: node scripts/make-art.mjs [path/to/playwright/index.mjs]
// og.png needs Playwright (not a project dependency); pass its index.mjs path or set IMD_PLAYWRIGHT.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/game/sprites.ts"), "utf8");

const palette = Object.fromEntries(
  [...src.matchAll(/^\s+(\w): "(#[0-9a-f]{6})"/gm)].map((m) => [m[1], m[2]]),
);
const rows = (name) => {
  const m = src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  return [...m[1].matchAll(/"([^"]+)"/g)].map((r) => r[1]);
};
const hamster = [...rows("HEAD"), ...rows("EYES_OPEN"), ...rows("BODY"), "...oo.....oo...."];

function svg(sprite, pad = 0) {
  const w = sprite[0].length + pad * 2;
  const h = sprite.length + pad * 2;
  const size = Math.max(w, h);
  const ox = (size - sprite[0].length) / 2;
  const oy = (size - sprite.length) / 2;
  let rects = "";
  sprite.forEach((line, y) =>
    [...line].forEach((k, x) => {
      if (k !== ".") rects += `<rect x="${x + ox}" y="${y + oy}" width="1" height="1" fill="${palette[k]}"/>`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${rects}</svg>\n`;
}

const favicon = svg(hamster, 1);
writeFileSync(join(root, "public/favicon.svg"), favicon);
console.log("wrote public/favicon.svg");

const pwPath = process.argv[2] ?? process.env.IMD_PLAYWRIGHT;
if (!pwPath) {
  console.log("skipped public/og.png (no Playwright path given)");
  process.exit(0);
}
const { chromium } = await import(pathToFileURL(pwPath).href);
const font = readFileSync(
  join(root, "node_modules/@fontsource/pixelify-sans/files/pixelify-sans-latin-600-normal.woff2"),
).toString("base64");
const html = `<!doctype html><html><head><style>
@font-face{font-family:P;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:600}
html,body{margin:0;width:1200px;height:630px}
body{display:flex;align-items:center;gap:64px;padding:0 96px;box-sizing:border-box;background:#fff4e0;color:#3b2414;font-family:P}
.art{width:360px;height:360px;flex:none;background:#7ccbff;border-radius:36px;display:grid;place-items:center}
.art svg{width:300px;height:300px}
h1{font-size:96px;line-height:1;margin:0 0 24px}
p{font-size:40px;line-height:1.2;margin:0;color:#6b4a31}
</style></head><body><div class="art">${favicon}</div><div><h1>Squeek Escape</h1><p>An endless hamster run paced by a real wheel.</p></div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.waitForTimeout(200);
await page.screenshot({ path: join(root, "public/og.png") });
await browser.close();
console.log("wrote public/og.png");
