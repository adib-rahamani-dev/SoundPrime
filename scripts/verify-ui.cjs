// Optional browser verification: requires Playwright locally or SOUNDPRIME_PLAYWRIGHT pointing to it.
const {chromium} = require(process.env.SOUNDPRIME_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
function wave() {
  const rate = 22050, samples = rate / 2, buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) buffer.writeInt16LE(Math.round(Math.sin(i * 440 * Math.PI * 2 / rate) * 18000 * (1 - i / samples)), 44 + i * 2);
  return buffer;
}
(async () => {
  fs.mkdirSync('docs', {recursive: true}); fs.mkdirSync('artifacts', {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.SOUNDPRIME_BROWSER ? {executablePath: process.env.SOUNDPRIME_BROWSER} : {})});
  try {
    const page = await browser.newPage({viewport: {width: 760, height: 1080}, deviceScaleFactor: 1});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve('extension/index.html')).href);
    await page.locator('.pad').last().waitFor();
    assert.equal(await page.locator('.pad').count(), 9);
    await page.screenshot({path: 'docs/preview.png', fullPage: true});
    await page.locator('#audio-files').setInputFiles([{name:'Test impact.wav', mimeType:'audio/wav', buffer:wave()}, {name:'Test click.wav', mimeType:'audio/wav', buffer:wave()}]);
    await page.waitForFunction(() => document.querySelector('#count').textContent === '02 / 09');
    await page.waitForFunction(() => document.querySelector('.pad-meta').textContent.includes('0.50s'));
    await page.locator('.pad-edit').first().click();
    await page.locator('#slot-name').fill('صدای تست <safe>');
    await page.locator('#recorder').focus(); await page.keyboard.press('Control+Shift+2');
    assert.equal(await page.locator('#save-slot').isDisabled(), true);
    assert.match(await page.locator('#key-feedback').textContent(), /تکراری/);
    await page.keyboard.press('Control+Alt+M');
    assert.equal(await page.locator('#save-slot').isDisabled(), false);
    await page.locator('#save-slot').click();
    assert.equal(await page.locator('.pad-name').first().textContent(), 'صدای تست <safe>');
    assert.equal(await page.locator('.shortcut').first().textContent(), 'Ctrl + Alt + M');
    await page.locator('.preview').first().click();
    await page.waitForFunction(() => document.querySelector('#now-playing').textContent.includes('صدای تست'));
    await page.locator('#stop').click();
    const xml = '<PremiereData><platform>windows</platform><item.0><commandname>cmd.test.conflict</commandname><modifier.ctrl>true</modifier.ctrl><modifier.alt>true</modifier.alt><virtualkey>2147483725</virtualkey></item.0></PremiereData>';
    await page.locator('#kys-file').setInputFiles({name:'test.kys', mimeType:'text/xml', buffer:Buffer.from(xml)});
    await page.waitForFunction(() => document.querySelector('.status').textContent === 'تداخل پریمیر');
    await page.locator('.pad-trigger').first().click();
    assert.match(await page.locator('#toast').textContent(), /پیش‌نمایش مرورگر/);
    await page.setViewportSize({width:360,height:820});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({path:'artifacts/mobile-preview.png',fullPage:true});
    await page.setViewportSize({width:760,height:1080});
    await page.screenshot({path:'artifacts/loaded-preview.png',fullPage:true});
    await page.reload();
    assert.equal(await page.locator('.pad-name').first().textContent(), 'صدای تست <safe>');
    assert.equal(await page.locator('.shortcut').first().textContent(), 'Ctrl + Alt + M');
    assert.deepEqual(errors, []);
    console.log('UI passed: 9 pads, actual waveform, multi-file upload, duplicate rejection, shortcut capture, Unicode name, playback, KYS conflict, preview guard, 360px layout, persistence; no browser errors.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
