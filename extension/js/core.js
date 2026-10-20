(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SoundCore = api;
}(this, function () {
  'use strict';
  function defaults() {
    return { version: 1, volume: 0.7, track: 0, enabled: true, kysPath: '', slots: Array.from({length: 9}, function (_, i) {
      return { name: '', path: '', duration: 0, shortcut: { key: 49 + i, modifiers: 6 } };
    }) };
  }
  function validShortcut(s) {
    return s && Number.isInteger(s.key) && ((s.key >= 48 && s.key <= 57) || (s.key >= 65 && s.key <= 90) || (s.key >= 112 && s.key <= 123)) &&
      Number.isInteger(s.modifiers) && s.modifiers >= 1 && s.modifiers <= 7;
  }
  function shortcutId(s) { return s ? s.modifiers + ':' + s.key : ''; }
  function label(s) {
    if (!s) return 'Set shortcut';
    return [(s.modifiers & 2) ? 'Ctrl' : '', (s.modifiers & 1) ? 'Alt' : '', (s.modifiers & 4) ? 'Shift' : '',
      s.key >= 112 ? 'F' + (s.key - 111) : String.fromCharCode(s.key)].filter(Boolean).join(' + ');
  }
  function conflict(slots, shortcut, exclude) {
    return slots.findIndex(function (s, i) { return i !== exclude && s.shortcut && shortcutId(s.shortcut) === shortcutId(shortcut); });
  }
  function normalize(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.slots) || data.slots.length !== 9) throw new Error('فایل بانک صدا معتبر نیست.');
    var out = defaults();
    out.volume = Number.isFinite(data.volume) ? Math.max(0, Math.min(1, data.volume)) : 0.7;
    out.track = Number.isInteger(data.track) && data.track >= 0 ? data.track : 0;
    out.enabled = data.enabled !== false;
    out.kysPath = typeof data.kysPath === 'string' ? data.kysPath : '';
    out.slots = data.slots.map(function (s) {
      if (!s || typeof s.path !== 'string' || typeof s.name !== 'string') throw new Error('ساختار پد معتبر نیست.');
      if (s.path && !/\.(wav|mp3|aif|aiff|m4a|aac|flac|ogg)$/i.test(s.path)) throw new Error('فرمت صوتی پشتیبانی نمی‌شود.');
      if (s.shortcut !== null && !validShortcut(s.shortcut)) throw new Error('میان‌بر نامعتبر است.');
      return {path: s.path, name: s.name.slice(0, 80), duration: Number.isFinite(s.duration) && s.duration > 0 ? s.duration : 0, shortcut: s.shortcut};
    });
    out.slots.forEach(function (s, i) { if (s.shortcut && conflict(out.slots, s.shortcut, i) !== -1) throw new Error('فایل بانک میان‌بر تکراری دارد.'); });
    return out;
  }
  // Windows Premiere .kys stores letter/digit VKs with the high bit set.
  function parseKys(xml) {
    if (!/<PremiereData\b/.test(xml) || !/<platform>\s*windows\s*<\/platform>/i.test(xml)) throw new Error('فایل KYS ویندوز معتبر نیست.');
    var result = {}, match, re = /<item\.\d+\b[^>]*>([\s\S]*?)<\/item\.\d+>/g;
    while ((match = re.exec(xml))) {
      var body = match[1];
      function value(tag) { var m = body.match(new RegExp('<' + tag.replace(/\./g, '\\.') + '>([^<]*)</')); return m ? m[1].trim() : ''; }
      var raw = Number(value('virtualkey')), key = raw >= 2147483648 ? raw - 2147483648 : (raw >= 7 && raw <= 18 ? raw + 105 : 0);
      if (!key) continue;
      var mod = (value('modifier.ctrl') === 'true' ? 2 : 0) | (value('modifier.alt') === 'true' ? 1 : 0) | (value('modifier.shift') === 'true' ? 4 : 0);
      result[mod + ':' + key] = value('commandname');
    }
    return result;
  }
  return { defaults: defaults, validShortcut: validShortcut, shortcutId: shortcutId, label: label, conflict: conflict, normalize: normalize, parseKys: parseKys };
}));
