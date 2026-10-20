const {test} = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
test('CEP on macOS uses the Mac data directory, native binary and Cmd bindings', async () => {
  const dom = new JSDOM(fs.readFileSync('extension/index.html','utf8'), {url:'file:///opt/OTINER/extension/index.html',runScripts:'outside-only'});
  const writes = new Map(); let launched;
  const fakeFS = {
    mkdirSync() {}, existsSync(p) { return p.endsWith('/OTINER.Hotkeys'); },
    mkdtempSync() { return '/tmp/soundprime-test'; },
    writeFileSync(p,s) { writes.set(p,s); }, renameSync(from,to) { writes.set(to,writes.get(from)); writes.delete(from); },
    rmSync() {}
  };
  const modules = {
    fs: fakeFS, path:path.posix, process:{platform:'darwin',env:{}},
    os:{homedir:()=>'/Users/test',tmpdir:()=>'/tmp'}, url:require('node:url'),
    child_process:{spawn(exe,args) { launched = {exe,args}; return {on() {},kill() {}}; }}
  };
  const w = dom.window;
  w.cep_node = {require:name=>modules[name]};
  w.__adobe_cep__ = {evalScript(script, callback) { callback('{"ok":true,"sequence":null,"tracks":[]}'); }};
  try {
    w.eval(fs.readFileSync('extension/js/core.js','utf8')); w.eval(fs.readFileSync('extension/js/app.js','utf8'));
    assert.equal(launched.exe, '/opt/OTINER/extension/bin/OTINER.Hotkeys');
    assert.deepEqual(Array.from(launched.args), ['/tmp/soundprime-test']);
    assert.match(writes.get('/tmp/soundprime-test/keys.tsv'), /^0\t12\t49/);
    w.document.querySelector('#enabled').click();
    assert.ok(writes.has('/Users/test/Library/Application Support/OTINER/bank.json'));
    assert.equal(writes.get('/tmp/soundprime-test/keys.tsv'), '');
  } finally { await new Promise(resolve => setImmediate(resolve)); w.close(); }
});
