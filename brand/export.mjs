// Exports each logo SVG as a high-resolution PNG and a vector PDF for printers.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path';
const dir = process.argv[2] || 'logos';
const b = await chromium.launch(); const p = await b.newPage();
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
  const svg = fs.readFileSync(path.join(dir, f), 'utf8');
  const [, W, H] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
  const pw = 3000, ph = Math.round(3000 * H / W);
  const html = (w, h) => `<!doctype html><style>@page{size:${w}px ${h}px;margin:0}html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style>${svg}`;
  await p.setViewportSize({ width: pw, height: ph });
  await p.setContent(html(pw, ph));
  await p.screenshot({ path: path.join(dir, f.replace('.svg', '.png')), omitBackground: true });
  const mw = 600, mh = Math.round(600 * H / W);
  await p.setContent(html(mw, mh));
  await p.pdf({ path: path.join(dir, f.replace('.svg', '.pdf')), width: mw + 'px', height: mh + 'px', printBackground: true, pageRanges: '1' });
}
await b.close(); console.log('exported');
