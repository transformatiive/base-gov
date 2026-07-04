import { chromium } from 'playwright';
const OUT = '/tmp/claude-0/-home-user-base-gov/09b95671-ea63-57d5-af06-ec01adbc9b6d/scratchpad';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const [vp, size] of [['desktop', {width:1440,height:900}], ['mobile', {width:375,height:800}]]) {
  const page = await (await browser.newContext({ viewport: size })).newPage();
  await page.goto('http://localhost:3400/#/login');
  await page.fill('input[name=username]', 'admin');
  await page.fill('input[name=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForTimeout(1000);
  await page.goto('http://localhost:3400/#/insights/map');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/v6-${vp}-map.png` });
  // clicar num distrito via tabela
  await page.evaluate(() => window._loadRegion && window._loadRegion('Porto'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/v6-${vp}-region.png`, fullPage: vp === 'mobile' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${vp}: overflowX=${overflow}`);
  // detalhe de anúncio interno
  await page.goto('http://localhost:3400/#/announcements/1');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/v6-${vp}-announcement.png` });
}
await browser.close();
