/** shot.cjs <htmlPath> <outPng> — screenshot an HTML file at 1080x1920. */
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer');
(async () => {
  const html = resolve(process.argv[2]);
  const out = resolve(process.argv[3]);
  const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await p.screenshot({ path: out });
  await b.close();
  console.log('✓', out);
})();
