import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1260, height: 900 }, deviceScaleFactor: 1.5 });
await p.goto('file:///home/claude/oab/brand/icon-sheet.html'); await p.waitForTimeout(400);
await p.screenshot({ path: '/tmp/claude-0/-home-claude/2471a414-d529-5c14-a5ec-0edc85f8155a/scratchpad/merch/icon-options.png', fullPage: true }); await b.close();
