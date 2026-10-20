const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');

// Offline DOM tests: no browser, external resources, network, or user files.
function panel(saved, platform = 'Win32') {
  const dom = new JSDOM(fs.readFileSync('extension/index.html', 'utf8'), {
    url: 'https://otiner.test/', runScripts: 'outside-only'
  });
  const w = dom.window;
  Object.defineProperty(w.navigator, 'platform', {value:platform});
  if (saved) w.localStorage.setItem('soundprime-bank', saved);
  w.HTMLCanvasElement.prototype.getContext = () => ({clearRect() {}, fillRect() {}});
  w.URL.createObjectURL = () => 'blob:test-audio'; w.URL.revokeObjectURL = () => {};
  w.AudioContext = class {
    async decodeAudioData() { return {duration: 10, getChannelData: () => new Float32Array(256)}; }
  };
  w.Audio = class {
    constructor(src) { this.src = src; this.currentTime = 0; this.duration = 10; this.paused = true; }
    async play() { this.paused = false; if (this.onloadedmetadata) this.onloadedmetadata(); }
    pause() { this.paused = true; }
    load() {}
    removeAttribute() {}
  };
  w.eval(fs.readFileSync('extension/js/core.js', 'utf8'));
  w.eval(fs.readFileSync('extension/js/app.js', 'utf8'));
  const $ = selector => w.document.querySelector(selector);
  const all = selector => Array.from(w.document.querySelectorAll(selector));
  const upload = (name, target = '#audio-files', text = '') => {
    const input = $(target);
    Object.defineProperty(input, 'files', {configurable: true, value: [{name, arrayBuffer: async () => new ArrayBuffer(256), text: async () => text}]});
    input.dispatchEvent(new w.Event('change'));
  };
  return {w, $, all, upload, close: () => dom.window.close()};
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('OTINER branding and direct rename work independently of shortcut conflicts', async () => {
  const p = panel();
  try {
    assert.equal(p.w.document.title, 'OTINER');
    assert.match(p.$('.brand').textContent, /^OTINER/);
    assert.equal(p.all('.pad').length, 9);
    p.upload('conflict.kys', '#kys-file', '<PremiereData><platform>windows</platform><item.0><commandname>cmd.conflict</commandname><modifier.ctrl>true</modifier.ctrl><modifier.shift>true</modifier.shift><virtualkey>2147483697</virtualkey></item.0></PremiereData>');
    await tick();
    assert.equal(p.$('.status').textContent, 'تداخل پریمیر');
    p.$('.pad-name').click();
    p.$('#rename-input').value = 'صدای دلخواه <safe>';
    p.$('#rename-form').dispatchEvent(new p.w.Event('submit', {cancelable:true}));
    assert.equal(p.$('.pad-name').textContent, 'صدای دلخواه <safe>');
    assert.equal(p.$('.status').textContent, 'تداخل پریمیر');
    assert.equal(p.$('.pad-name').children.length, 0);
    p.upload('impact.wav'); await tick();
    assert.equal(p.$('.pad-name').textContent, 'صدای دلخواه <safe>');
    assert.equal(p.$('#count').textContent, '01 / 09');
    const saved = p.w.localStorage.getItem('soundprime-bank');
    const restored = panel(saved);
    try { assert.equal(restored.$('.pad-name').textContent, 'صدای دلخواه <safe>'); }
    finally { restored.close(); }
  } finally { p.close(); }
});
test('waveform previews; transport pauses, resumes, seeks and replays; insert remains separate', async () => {
  const p = panel();
  try {
    p.upload('impact.wav'); await tick();
    p.$('.pad-trigger').click(); await tick();
    assert.equal(p.$('#now-playing').textContent, 'impact');
    assert.equal(p.$('#preview-play').textContent, 'مکث');
    assert.equal(p.$('#preview-position').disabled, false);
    p.$('#preview-position').value = '500';
    p.$('#preview-position').dispatchEvent(new p.w.Event('input'));
    assert.equal(p.$('#preview-time').textContent, '0:05 / 0:10');
    p.$('#preview-play').click(); await tick();
    assert.equal(p.$('#preview-play').textContent, 'پخش');
    p.$('#preview-play').click(); await tick();
    assert.equal(p.$('#preview-play').textContent, 'مکث');
    p.$('.pad-name').click(); p.$('#rename-input').value = 'New name';
    p.$('#rename-form').dispatchEvent(new p.w.Event('submit', {cancelable:true}));
    assert.equal(p.$('#now-playing').textContent, 'New name');
    p.$('#stop').click();
    assert.equal(p.$('#preview-position').disabled, true);
    assert.equal(p.$('#preview-time').textContent, '0:00 / 0:00');
    p.$('#preview-play').click(); await tick();
    assert.equal(p.$('#now-playing').textContent, 'New name');
    p.$('.insert').click(); await tick();
    assert.match(p.$('#toast').textContent, /پیش‌نمایش مرورگر/);
  } finally { p.close(); }
});
test('rename cancellation and empty name fallback preserve sound and shortcut', async () => {
  const p = panel();
  try {
    p.upload('impact.wav'); await tick();
    const before = p.$('.shortcut').textContent;
    p.$('.pad-name').click(); p.$('#rename-input').value = 'discard'; p.$('#cancel-rename').click();
    assert.equal(p.$('.pad-name').textContent, 'impact');
    p.$('.pad-name').click(); p.$('#rename-input').value = '  ';
    p.$('#rename-form').dispatchEvent(new p.w.Event('submit', {cancelable:true}));
    assert.equal(p.$('.pad-name').textContent, 'impact');
    assert.equal(p.$('.shortcut').textContent, before);
  } finally { p.close(); }
});
test('Mac panel captures Command and checks the active Mac KYS without Windows labels', async () => {
  const p = panel(null, 'MacIntel');
  try {
    assert.equal(p.$('.shortcut').textContent, 'Cmd + Shift + 1');
    p.$('.pad-edit').click(); p.$('#recorder').focus();
    p.$('#recorder').dispatchEvent(new p.w.KeyboardEvent('keydown', {code:'KeyM',key:'m',metaKey:true,altKey:true,bubbles:true,cancelable:true}));
    assert.equal(p.$('#recorder').textContent, 'Cmd + Option + M');
    assert.equal(p.$('#save-slot').disabled, false);
    p.$('#save-slot').click();
    assert.equal(p.$('.shortcut').textContent, 'Cmd + Option + M');
    p.upload('mac.kys', '#kys-file', '<PremiereData><platform>macintosh</platform><item.0><virtualkey>2147483725</virtualkey><modifier.command>true</modifier.command><modifier.opt>true</modifier.opt><commandname>cmd.mac.test</commandname></item.0></PremiereData>');
    await tick();
    assert.equal(p.$('.status').textContent, 'تداخل پریمیر');
  } finally { p.close(); }
});
