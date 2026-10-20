const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup(options = {}) {
  const item = {type: 1, name: 'impact.wav', getMediaPath: () => 'C:\\impact.wav', getInPoint: () => ({seconds: 0}), getOutPoint: () => ({seconds: options.duration ?? 2}), getAudioChannelMapping: () => ({audioClipsNumber: options.audioClips ?? 1, audioChannelsType: options.audioType ?? 1})};
  const clips = (options.clips || []).slice(); clips.numItems = clips.length;
  let calls = [];
  const track = {name: 'Audio 1', isLocked: () => !!options.locked, clips,
    overwriteClip: (projectItem, at) => { calls.push({item: projectItem, at}); if (!options.failInsert) clips.numItems++; }};
  const audioTracks = [track]; audioTracks.numTracks = 1;
  const children = options.import ? [] : [item]; children.numItems = children.length;
  const rootItem = {children, createBin: () => ({type: 2, name: 'Oteener Sound Design', children: Object.assign([], {numItems: 0})})};
  const project = {rootItem, activeSequence: options.noSequence ? null : {name: 'Test', timebase: '8467200000', audioTracks, getPlayerPosition: () => ({seconds: 5})}, importFiles: (paths, quiet, bin) => {
    bin.children.push(item); bin.children.numItems++; return true;
  }};
  const context = {app: {project, setExtensionPersistent() {}}, ProjectItemType: {BIN: 2}, File: function(p) { this.fsName = p; this.exists = options.exists !== false; }};
  vm.createContext(context); vm.runInContext(fs.readFileSync('extension/jsx/host.jsx', 'utf8'), context);
  return {host: context.SoundPrime, calls};
}
test('placement uses only target audio track at playhead, and imports on demand', () => {
  for (const imported of [true, false]) {
    const {host, calls} = setup({import: imported});
    assert.equal(JSON.parse(host.place('C:\\impact.wav', 0)).ok, true);
    assert.equal(calls.length, 1); assert.equal(calls[0].at, 5);
  }
});
test('overlap, missing file, locked track and invalid destinations do not overwrite', () => {
  for (const options of [{clips: [{start:{seconds:6},end:{seconds:10}}]}, {exists:false}, {locked:true}, {noSequence:true}, {duration:0}]) {
    const {host, calls} = setup(options);
    assert.equal(JSON.parse(host.place('C:\\impact.wav', 0)).ok, false); assert.equal(calls.length, 0);
  }
  const {host,calls} = setup();
  assert.equal(JSON.parse(host.place('C:\\impact.wav', -1)).ok, false);
  assert.equal(JSON.parse(host.place('C:\\impact.wav', 5)).ok, false);
  assert.equal(JSON.parse(host.place('C:\\impact.wav', 0.5)).ok, false);
  assert.equal(calls.length, 0);
});
test('touching but non-overlapping boundaries are allowed', () => {
  const {host} = setup({clips: [{start:{seconds:1},end:{seconds:5}}, {start:{seconds:7},end:{seconds:8}}]});
  assert.equal(JSON.parse(host.place('C:\\impact.wav', 0)).ok, true);
});
test('host does not claim success for failed insertion', () => {
  assert.equal(JSON.parse(setup({failInsert:true}).host.place('C:\\impact.wav', 0)).ok, false);
});
test('split channel mappings cannot overwrite adjacent tracks', () => {
  for (const options of [{audioClips:2}, {audioType:2}]) {
    const {host,calls} = setup(options); assert.equal(JSON.parse(host.place('C:\\impact.wav', 0)).ok, false); assert.equal(calls.length, 0);
  }
});
test('collision check protects the last frame when audio duration is not frame aligned', () => {
  const {host,calls} = setup({duration:0.501, clips:[{start:{seconds:5.52},end:{seconds:6}}]});
  assert.equal(JSON.parse(host.place('C:\\impact.wav', 0)).ok, false); assert.equal(calls.length, 0);
});
test('host serializes Unicode/control characters and reports absence of sequence', () => {
  assert.equal(JSON.parse(setup({noSequence:true}).host.info()).sequence, null);
  assert.equal(JSON.parse(setup().host.info()).tracks[0], 'Audio 1');
});
