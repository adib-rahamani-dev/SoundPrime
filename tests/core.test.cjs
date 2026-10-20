const {test} = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../extension/js/core.js');
test('nine independent pads with unique defaults', () => {
  const state = Core.defaults();
  assert.equal(state.slots.length, 9);
  assert.equal(new Set(state.slots.map(s => Core.shortcutId(s.shortcut))).size, 9);
  assert.equal(Core.conflict(state.slots, state.slots[1].shortcut, 0), 1);
  assert.equal(Core.conflict(state.slots, state.slots[1].shortcut, 1), -1);
  state.slots[0].name = 'A'; assert.equal(Core.defaults().slots[0].name, '');
});
test('restoration rejects duplicate, malformed and non-audio bank entries', () => {
  const state = Core.defaults(); state.slots[0].shortcut = state.slots[1].shortcut;
  assert.throws(() => Core.normalize(state), /تکراری/);
  assert.throws(() => Core.normalize({version: 1, slots: []}));
  const bad = Core.defaults(); bad.slots[0].path = 'C:\\attack.jsx'; assert.throws(() => Core.normalize(bad));
  bad.slots[0].path = ''; bad.slots[0].shortcut.key = 999; assert.throws(() => Core.normalize(bad));
});
test('bank round trip preserves Unicode/Windows paths and bounds volume', () => {
  const state = Core.defaults(); state.slots[0].name = 'صدای تست'; state.slots[0].path = 'C:\\صدا\\impact.wav'; state.volume = 4;
  const out = Core.normalize(JSON.parse(JSON.stringify(state)));
  assert.equal(out.slots[0].path, state.slots[0].path); assert.equal(out.volume, 1);
  assert.equal(Core.label(out.slots[0].shortcut), 'Ctrl + Shift + 1');
  out.slots[0].shortcut = null; assert.equal(Core.normalize(out).slots[0].shortcut, null);
});
test('KYS maps Windows high-bit VK and Adobe F-key codes, all contexts', () => {
  const xml = '<PremiereData><platform>windows</platform><context.application><item.0 Version="1"><commandname>cmd.file.save</commandname><modifier.ctrl>true</modifier.ctrl><modifier.shift>false</modifier.shift><virtualkey>2147483731</virtualkey></item.0></context.application><context.timeline><item.1><commandname>cmd.capture</commandname><modifier.shift>true</modifier.shift><virtualkey>11</virtualkey></item.1></context.timeline></PremiereData>';
  const keys = Core.parseKys(xml);
  assert.equal(keys['2:83'], 'cmd.file.save'); assert.equal(keys['4:116'], 'cmd.capture');
  assert.throws(() => Core.parseKys('<html>not KYS</html>'));
  assert.throws(() => Core.parseKys('<PremiereData><platform>mac</platform></PremiereData>'));
});
test('Mac shortcuts default to Command and retain Option/Control independently', () => {
  const mac = Core.defaults(true);
  assert.equal(Core.label(mac.slots[0].shortcut, true), 'Cmd + Shift + 1');
  assert.equal(Core.label({key:77,modifiers:15}, true), 'Cmd + Ctrl + Option + Shift + M');
  assert.equal(Core.validShortcut({key:77,modifiers:12}, true), true);
  assert.equal(Core.validShortcut({key:77,modifiers:12}), false);
  assert.equal(Core.validShortcut({key:77,modifiers:5}, true), false);
  assert.equal(Core.normalize(mac, true).slots[0].shortcut.modifiers, 12);
  assert.throws(() => Core.normalize(mac));
});
test('Mac KYS uses macintosh, command and opt; cross-platform KYS is rejected', () => {
  const xml = '<PremiereData><platform>macintosh</platform><item.0><virtualkey>2147483731</virtualkey><modifier.command>true</modifier.command><modifier.opt>true</modifier.opt><modifier.ctrl>false</modifier.ctrl><modifier.shift>true</modifier.shift><commandname>cmd.file.saveas</commandname></item.0><item.1><virtualkey>7</virtualkey><modifier.ctrl>true</modifier.ctrl><commandname>cmd.help</commandname></item.1></PremiereData>';
  assert.equal(Core.parseKys(xml, true)['13:83'], 'cmd.file.saveas');
  assert.equal(Core.parseKys(xml, true)['2:112'], 'cmd.help');
  assert.throws(() => Core.parseKys(xml));
  assert.throws(() => Core.parseKys('<PremiereData><platform>windows</platform></PremiereData>', true));
});
