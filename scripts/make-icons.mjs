// Renders public/icon.svg to PNG/ICO sizes with Chromium (dev-time helper).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
const svg = fs.readFileSync('public/icon.svg', 'utf8').replace('Noto Sans Tamil, sans-serif', 'KT');
const font = fs.readFileSync('public/fonts/noto-sans-tamil-tamil-700-normal.woff2').toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [size, out] of [[512, 'public/icon-512.png'], [192, 'public/icon-192.png'], [256, 'build/icon.png'], [1024, 'build/icon-1024.png']]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>@font-face{font-family:KT;src:url(data:font/woff2;base64,${font})}html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, omitBackground: true });
}
await browser.close();
