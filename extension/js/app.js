(function () {
  'use strict';
  const Core = window.SoundCore, $ = id => document.getElementById(id);
  const isCEP = !!window.__adobe_cep__;
  const req = window.cep_node ? window.cep_node.require : (typeof require === 'function' ? require : null);
  const fs = isCEP && req ? req('fs') : null;
  const path = fs ? req('path') : null;
  const nodeProcess = fs ? req('process') : null;
  const isMac = nodeProcess ? nodeProcess.platform === 'darwin' : /Mac/.test(navigator.platform);
  const shortcutLabel = s => Core.label(s, isMac);
  const childProcess = fs ? req('child_process') : null;
  const fileURL = fs ? req('url').pathToFileURL : null;
  const root = fs ? path.dirname(decodeURIComponent(location.pathname).replace(/^\/(\w:)/, '$1')) : '';
  const dataDir = fs ? (isMac ? path.join(req('os').homedir(), 'Library', 'Application Support', 'OTINER') : path.join(nodeProcess.env.APPDATA, 'Oteener', 'SoundPrime')) : '';
  const configFile = fs ? path.join(dataDir, 'bank.json') : '';
  let state = Core.defaults(isMac), nativeStatus = {}, kys = {}, kysLoaded = false;
  let helper = null, session = '', audio = null, audioContext = null;
  let peaks = new Map(), browserFiles = new Map(), playing = -1, lastPreview = -1, busy = false;
  let editing = -1, pendingShortcut = null, modalFocus = null, sequence = null, missing = new Set();
  let toastTimer, dialogKeyHandler = null, lastHeartbeat = 0, helperFailed = false;
  let activeFilter = 'all', searchQuery = '';
  function toast(message, error) {
    $('toast').textContent = message; $('toast').classList.toggle('error', !!error); $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4600);
  }
  function readState() {
    try {
      if (fs) {
        fs.mkdirSync(dataDir, { recursive: true });
        if (fs.existsSync(configFile)) state = Core.normalize(JSON.parse(fs.readFileSync(configFile, 'utf8')), isMac);
      } else {
        const saved = localStorage.getItem('soundprime-bank');
        if (saved) state = Core.normalize(JSON.parse(saved), isMac);
      }
    } catch (e) { toast('بانک ذخیره‌شده خوانده نشد؛ نسخهٔ قبلی در پوشهٔ تنظیمات نگه داشته شده است.', true); }
  }
  function writeAtomic(destination, contents) {
    const temp = destination + '.tmp'; fs.writeFileSync(temp, contents, 'utf8'); fs.renameSync(temp, destination);
  }
  function save() {
    try {
      if (fs) {
        if (fs.existsSync(configFile)) fs.copyFileSync(configFile, configFile + '.bak');
        writeAtomic(configFile, JSON.stringify(state, null, 2));
      } else localStorage.setItem('soundprime-bank', JSON.stringify(state));
      syncNative();
    } catch (e) { toast('ذخیره نشد: ' + e.message, true); }
  }
  function host(script) {
    return new Promise((resolve, reject) => {
      if (!isCEP) { reject(new Error('در حالت پیش‌نمایش مرورگر هستید؛ درج صدا فقط داخل پریمیر فعال است.')); return; }
      let done = false;
      const timeout = setTimeout(() => { if (!done) { done = true; reject(new Error('پریمیر پاسخ نداد؛ پنجره‌های باز یا وضعیت پروژه را بررسی کنید.')); } }, 30000);
      window.__adobe_cep__.evalScript(script, result => {
        if (done) return; done = true; clearTimeout(timeout);
        try { const data = JSON.parse(result); if (!data.ok) throw new Error(data.error); resolve(data); }
        catch (e) { reject(new Error(e.message || 'پاسخ پریمیر نامعتبر است.')); }
      });
    });
  }
  function syncNative() {
    if (!fs || !session) return;
    const lines = [];
    state.slots.forEach((s, i) => {
      // Register assigned keys even on empty pads so availability can be checked.
      if (state.enabled && s.shortcut && !kys[Core.shortcutId(s.shortcut)]) lines.push([i, s.shortcut.modifiers, s.shortcut.key].join('\t'));
    });
    writeAtomic(path.join(session, 'keys.tsv'), lines.join('\n'));
    nativeStatus = {};
  }
  function pauseNative(paused) {
    if (!fs || !session) return;
    try {
      const p = path.join(session, 'paused');
      if (paused) fs.writeFileSync(p, '1'); else if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (e) { toast(e.message, true); }
  }
  function startHelper() {
    if (!fs) return;
    try {
      session = fs.mkdtempSync(path.join(req('os').tmpdir(), 'soundprime-'));
      fs.writeFileSync(path.join(session, 'heartbeat'), '1');
      syncNative();
      const exe = path.join(root, 'bin', isMac ? 'OTINER.Hotkeys' : 'SoundPrime.Hotkeys.exe');
      if (!fs.existsSync(exe)) throw new Error('همراه میان‌بر نصب نشده؛ نصب‌کننده را دوباره اجرا کنید.');
      helper = childProcess.spawn(exe, [session], { windowsHide: true, stdio: 'ignore' });
      helper.on('error', e => { helperFailed = true; renderStatus(); toast(e.message, true); });
      helper.on('exit', () => { helper = null; helperFailed = true; renderStatus(); });
    } catch (e) { helperFailed = true; toast(e.message, true); }
  }
  function pollNative() {
    if (!fs || !session || !helper || helperFailed) return;
    try {
      if (Date.now() - lastHeartbeat > 1000) { fs.writeFileSync(path.join(session, 'heartbeat'), '1'); lastHeartbeat = Date.now(); }
      const statusPath = path.join(session, 'status.tsv');
      if (fs.existsSync(statusPath)) {
        const next = {};
        fs.readFileSync(statusPath, 'utf8').split('\n').forEach(line => { const p = line.split('\t'); if (p.length === 2) next[Number(p[0])] = p[1]; });
        if (JSON.stringify(next) !== JSON.stringify(nativeStatus)) { nativeStatus = next; renderStatus(); }
      }
      const files = fs.readdirSync(session).filter(n => /^event-.*\.txt$/.test(n)).sort();
      files.forEach(name => {
        const p = path.join(session, name);
        const raw = fs.readFileSync(p, 'utf8').trim();
        const slot = /^[0-8]$/.test(raw) ? Number(raw) : -1; const age = Date.now() - fs.statSync(p).mtimeMs;
        fs.unlinkSync(p);
        if (age < 1500 && state.enabled && $('modal').hidden && Number.isInteger(slot) && slot >= 0 && slot < 9) place(slot);
      });
    } catch (e) { /* File replacement by the companion can briefly race a read; retry next tick. */ }
  }
  function loadKys() {
    kys = {}; kysLoaded = false;
    if (fs && state.kysPath) {
      try { kys = Core.parseKys(fs.readFileSync(state.kysPath, 'utf8'), isMac); kysLoaded = true; }
      catch (e) { toast('فایل میان‌بر پریمیر خوانده نشد. برای بررسی دوباره آن را انتخاب کنید.', true); }
    }
  }
  function statusFor(i) {
    const s = state.slots[i];
    if (!state.enabled) return ['متوقف', 'warn'];
    if (!s.shortcut) return ['بدون میان‌بر', ''];
    if (kys[Core.shortcutId(s.shortcut)]) return ['تداخل پریمیر', 'error'];
    if (!fs) return ['پیش‌نمایش', 'warn'];
    if (helperFailed) return ['همراه قطع است', 'error'];
    if (nativeStatus[i] === 'conflict') return [isMac ? 'اشغال در مک' : 'اشغال در ویندوز', 'error'];
    if (nativeStatus[i] === 'unavailable') return ['ثبت میان‌بر ناموفق', 'error'];
    if (!nativeStatus[i]) return ['در حال بررسی', ''];
    if (!kysLoaded) return ['KYS بررسی نشده', 'warn'];
    return [nativeStatus[i] === 'active' ? 'آماده ✓' : 'آزاد ✓', 'ok'];
  }
  function renderStatus() {
    document.querySelectorAll('.pad').forEach((el, i) => {
      const status = statusFor(i), node = el.querySelector('.status');
      node.textContent = status[0]; node.className = 'status ' + status[1];
      node.title = kys[Core.shortcutId(state.slots[i].shortcut)] || 'بررسی میان‌برهای پریمیر بر اساس فایل KYS انتخابی است.';
    });
  }
  function button(cls, text, title, click) {
    const b = document.createElement('button'); b.className = cls; b.textContent = text;
    b.title = title; b.setAttribute('aria-label', title); b.addEventListener('click', click); return b;
  }
  function render() {
    const pads = $('pads'); pads.textContent = '';
    document.documentElement.dataset.theme = state.theme;
    $('theme').textContent = state.theme === 'dark' ? 'تم روشن' : 'تم تیره';
    $('theme').setAttribute('aria-pressed', String(state.theme === 'dark'));
    $('count').textContent = String(state.slots.filter(s => s.path).length).padStart(2, '0') + ' / 09';
    $('volume').value = Math.round(state.volume * 100); $('volume-value').textContent = $('volume').value + '%';
    $('enabled').setAttribute('aria-pressed', String(state.enabled));
    $('enabled').querySelector('span').textContent = state.enabled ? 'میان‌برها روشن' : 'میان‌برها خاموش';
    state.slots.forEach((s, i) => {
      const el = document.createElement('article');
      el.className = 'pad ' + (s.path ? 'loaded' : 'empty') + (playing === i ? ' playing' : '');
      const head = document.createElement('div'); head.className = 'pad-head';
      const num = document.createElement('span'); num.className = 'pad-number'; num.textContent = 'PAD / 0' + (i + 1);
      head.append(num, button('pad-edit', '···', 'تنظیم پد ' + (i + 1), () => editSlot(i))); el.append(head);
      const trigger = button('pad-trigger', '', s.path ? 'پیش‌شنوی ' + s.name : 'افزودن صدا به پد ' + (i + 1), () => s.path ? preview(i) : chooseAudio(i));
      const wave = document.createElement('div'); wave.className = 'wave-wrap';
      if (s.path) {
        const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = 80; canvas.dataset.slot = i; wave.append(canvas);
      } else { const plus = document.createElement('span'); plus.className = 'empty-sign'; plus.textContent = '+'; wave.append(plus); }
      trigger.append(wave); el.append(trigger);
      const name = button('pad-name', s.name || 'انتخاب اسم', 'تغییر نام پد ' + (i + 1), () => renameSlot(i));
      name.dir = 'auto'; el.append(name);
      const meta = document.createElement('div'); meta.className = 'pad-meta';
      const detail = document.createElement('span');
      detail.textContent = s.path ? (missing.has(i) ? 'FILE MISSING' : s.path.split('.').pop().toUpperCase() + ' · ' + (s.duration ? s.duration.toFixed(2) + 's' : '—')) : 'DROP YOUR SOUND';
      meta.append(detail);
      el.append(meta);
      if (s.path) {
        const actions = document.createElement('div'); actions.className = 'pad-actions';
        actions.append(button('preview', playing === i ? 'توقف' : 'پریویو', 'پیش‌شنوی ' + s.name, () => preview(i)),
          button('insert', 'درج', 'درج ' + s.name + ' در تایم‌لاین', () => place(i)));
        el.append(actions);
      }
      const bottom = document.createElement('div'); bottom.className = 'pad-bottom';
      bottom.append(button('shortcut', shortcutLabel(s.shortcut), 'تنظیم میان‌بر پد ' + (i + 1), () => editSlot(i)));
      const status = document.createElement('span'); status.className = 'status'; bottom.append(status); el.append(bottom);
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dragover'); });
      el.addEventListener('dragleave', () => el.classList.remove('dragover'));
      el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('dragover'); addFiles(Array.from(e.dataTransfer.files), i); });
      pads.append(el);
      if (s.path) { if (peaks.has(s.path)) drawWave(i); else decode(i); }
    });
    renderStatus();
    filterPads();
  }
  function filterPads() {
    let visible = 0;
    document.querySelectorAll('.pad').forEach((el, i) => {
      const s = state.slots[i];
      const category = activeFilter === 'all' || (activeFilter === 'loaded' ? !!s.path : !s.path);
      const text = (s.name + ' ' + s.path.split(/[\\/]/).pop()).toLocaleLowerCase();
      el.hidden = !(category && (!searchQuery || text.includes(searchQuery)));
      if (!el.hidden) visible++;
    });
    $('no-results').hidden = visible > 0;
    document.querySelectorAll('[data-filter]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.filter === activeFilter)));
  }
  function getURL(i) {
    const p = state.slots[i].path;
    if (fs) { if (!fs.existsSync(p)) throw new Error('فایل پیدا نشد؛ از تنظیمات پد دوباره انتخابش کنید.'); return fileURL(p).href; }
    if (!browserFiles.has(p)) throw new Error('در پیش‌نمایش مرورگر، بعد از تازه‌سازی فایل را دوباره انتخاب کنید.');
    return browserFiles.get(p).url;
  }
  async function decode(i) {
    const s = state.slots[i], originalPath = s.path;
    if (peaks.has(originalPath)) return;
    // Placeholder is a flat line until actual audio samples have been decoded.
    peaks.set(originalPath, null); drawWave(i);
    try {
      let array;
      if (fs) {
        if (!fs.existsSync(originalPath)) { missing.add(i); setTimeout(render, 0); return; }
        const size = fs.statSync(originalPath).size;
        if (size > 80 * 1024 * 1024) return;
        const b = fs.readFileSync(originalPath); array = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      } else array = await browserFiles.get(originalPath).file.arrayBuffer();
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const buffer = await audioContext.decodeAudioData(array), channel = buffer.getChannelData(0), points = [];
      for (let n = 0; n < 58; n++) {
        const start = Math.floor(n * channel.length / 58), end = Math.floor((n + 1) * channel.length / 58); let max = 0;
        for (let j = start; j < end; j += Math.max(1, Math.floor((end - start) / 300))) max = Math.max(max, Math.abs(channel[j]));
        points.push(max);
      }
      peaks.set(originalPath, points);
      if (state.slots[i].path === originalPath) { s.duration = buffer.duration; save(); render(); }
    } catch (e) { /* Premiere can import codecs the CEP browser cannot decode. */ }
  }
  function drawWave(i) {
    const canvas = document.querySelector('canvas[data-slot="' + i + '"]'); if (!canvas) return;
    const ctx = canvas.getContext('2d'), points = peaks.get(state.slots[i].path);
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = state.theme === 'dark' ? '#ffd800' : '#786500';
    if (!points) { ctx.fillStyle = state.theme === 'dark' ? '#68686e' : '#a3a3a9'; ctx.fillRect(0, 39, canvas.width, 2); return; }
    points.forEach((v, n) => { const h = Math.max(3, v * 74); ctx.fillRect(n * 6.2, (80 - h) / 2, 3.4, h); });
  }
  function stop() {
    if (audio) { audio.onended = null; audio.onerror = null; audio.ontimeupdate = null; audio.onloadedmetadata = null; audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
    playing = -1; $('now-playing').textContent = 'یک صدا را برای شنیدن انتخاب کن'; updateMonitor(); render();
  }
  function clock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
  }
  function updateMonitor() {
    const duration = audio && Number.isFinite(audio.duration) ? audio.duration : 0;
    const current = audio ? audio.currentTime : 0;
    $('preview-position').disabled = !duration;
    $('preview-position').value = duration ? Math.round(current / duration * 1000) : 0;
    $('preview-time').textContent = clock(current) + ' / ' + clock(duration);
    $('preview-play').disabled = lastPreview < 0 || !state.slots[lastPreview].path;
    $('preview-play').textContent = audio && !audio.paused ? 'مکث' : 'پخش';
  }
  async function preview(i) {
    if (playing === i) { stop(); return; }
    stop();
    let current;
    try {
      current = new Audio(getURL(i)); audio = current; audio.volume = state.volume; playing = i; lastPreview = i;
      current.ontimeupdate = updateMonitor; current.onloadedmetadata = updateMonitor;
      current.onended = () => { if (audio === current) stop(); };
      current.onerror = () => { if (audio === current) { stop(); toast('پیش‌شنوی این فرمت ممکن نشد؛ WAV یا MP3 را امتحان کنید.', true); } };
      await current.play();
      if (audio === current) { $('now-playing').textContent = state.slots[i].name; updateMonitor(); render(); }
    } catch (e) { if (!current || audio === current) { stop(); toast(e.message, true); } }
  }
  async function place(i) {
    const s = state.slots[i];
    if (!s.path) { toast('اول به این پد صدا اضافه کنید.'); return; }
    if (busy) { toast('درج قبلی هنوز در حال انجام است.'); return; }
    busy = true;
    try {
      if (fs && !fs.existsSync(s.path)) throw new Error('فایل صدا پیدا نشد؛ دوباره انتخابش کنید.');
      const result = await host('SoundPrime.place(' + JSON.stringify(s.path).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + ',' + Number(state.track) + ')');
      toast('«' + result.name + '» روی ترک A' + (state.track + 1) + ' قرار گرفت.');
    } catch (e) { toast(e.message, true); } finally { busy = false; }
  }
  let importTarget = null;
  function chooseAudio(i) { importTarget = Number.isInteger(i) ? i : null; pauseNative(true); $('audio-files').click(); }
  function addFiles(files, target) {
    const supported = files.filter(f => /\.(wav|mp3|aif|aiff|m4a|aac|flac|ogg)$/i.test(f.name));
    if (!supported.length) { toast('یک فایل صوتی WAV، MP3، AIFF، M4A، AAC، FLAC یا OGG انتخاب کنید.', true); return; }
    let added = 0;
    supported.forEach((f, n) => {
      const i = Number.isInteger(target) && n === 0 ? target : state.slots.findIndex(s => !s.path);
      if (i < 0) return;
      const p = fs ? f.path : f.name;
      if (!p) return;
      const previous = state.slots[i];
      const previousFileName = previous.path.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
      const chosenName = previous.name && previous.name !== previousFileName ? previous.name : f.name.replace(/\.[^.]+$/, '');
      if (playing === i) stop();
      if (!fs) { const old = browserFiles.get(p); if (old) URL.revokeObjectURL(old.url); browserFiles.set(p, {file: f, url: URL.createObjectURL(f)}); }
      state.slots[i] = { path: p, name: chosenName, duration: 0, shortcut: previous.shortcut };
      missing.delete(i); peaks.delete(p); added++;
    });
    save(); render(); toast(added + ' صدا اضافه شد.' + (added < supported.length ? ' ظرفیت بانک ۹ صداست.' : ''));
  }
  function showDialog() {
    modalFocus = document.activeElement; $('modal').hidden = false; pauseNative(true);
    setTimeout(() => { const el = $('dialog-body').querySelector('input,button,[tabindex]'); (el || $('close-dialog')).focus(); }, 30);
  }
  function closeDialog() {
    $('modal').hidden = true; editing = -1; dialogKeyHandler = null; pauseNative(false);
    if (modalFocus && modalFocus.isConnected) modalFocus.focus();
  }
  function editSlot(i) {
    editing = i; pendingShortcut = state.slots[i].shortcut ? Object.assign({}, state.slots[i].shortcut) : null;
    $('dialog-body').innerHTML = '<h2 id="dialog-title">تنظیم پد ۰' + (i + 1) + '</h2><label for="slot-name">نام صدا</label><input id="slot-name" type="text" maxlength="80"><label>میان‌بر دلخواه</label><div id="recorder" class="record" tabindex="0" role="button" aria-label="برای ضبط میان‌بر فوکوس کنید"></div><p class="hint">روی کادر بالا کلیک کنید و Ctrl، Alt یا Shift را همراه یک حرف انگلیسی، عدد یا F1 تا F12 بزنید.</p><div id="key-feedback" class="feedback" role="status"></div><p class="hint">تداخل پریمیر فقط با فایل KYS انتخاب‌شده بررسی می‌شود. میان‌بر ویندوز ممکن است تا زمان آزاد شدن برنامهٔ دیگر اشغال باشد.</p><div class="dialog-actions"><button id="save-slot" class="primary">ذخیره</button><button id="replace-slot" class="secondary">انتخاب صدا</button><button id="clear-slot" class="secondary danger">پاک کردن صدا</button></div><button id="clear-key" class="secondary">حذف میان‌بر</button>';
    $('slot-name').value = state.slots[i].name; $('recorder').textContent = shortcutLabel(pendingShortcut);
    if (isMac) {
      $('dialog-body').querySelector('.hint').textContent = 'روی کادر بالا کلیک کنید و Cmd یا Ctrl را همراه یک حرف انگلیسی، عدد یا F1 تا F12 بزنید. Option و Shift هم قابل ترکیب‌اند.';
      $('dialog-body').querySelectorAll('.hint')[1].textContent = 'تداخل پریمیر با فایل KYS مک انتخاب‌شده بررسی می‌شود. کلید رزروشدهٔ سیستم یا برنامهٔ دیگر ممکن است ثبت نشود.';
    }
    function feedback() {
      const dup = pendingShortcut ? Core.conflict(state.slots, pendingShortcut, i) : -1;
      const command = pendingShortcut ? kys[Core.shortcutId(pendingShortcut)] : '';
      $('save-slot').disabled = dup !== -1 || !!command;
      $('key-feedback').classList.toggle('error', dup !== -1 || !!command);
      $('key-feedback').textContent = dup !== -1 ? 'تکراری با پد ' + (dup + 1) : command ? 'تداخل پریمیر: ' + command : pendingShortcut ? 'داخل بانک تکراری نیست ✓' : 'میان‌بر غیرفعال می‌شود.';
    }
    dialogKeyHandler = e => {
      if (document.activeElement !== $('recorder')) return;
      e.preventDefault(); e.stopPropagation();
      if (['Control','Alt','Shift','Meta'].includes(e.key)) return;
      let key = 0;
      if (/^Key[A-Z]$/.test(e.code)) key = e.code.charCodeAt(3);
      else if (/^Digit[0-9]$/.test(e.code)) key = e.code.charCodeAt(5);
      else if (/^F([1-9]|1[0-2])$/.test(e.code)) key = 111 + Number(e.code.slice(1));
      const s = {key: key, modifiers: (e.ctrlKey ? 2 : 0) | (e.altKey ? 1 : 0) | (e.shiftKey ? 4 : 0) | (isMac && e.metaKey ? 8 : 0)};
      if ((!isMac && e.metaKey) || !Core.validShortcut(s, isMac)) { $('key-feedback').textContent = isMac ? 'یک کلید پشتیبانی‌شده همراه Cmd یا Ctrl بزنید.' : 'یک کلید پشتیبانی‌شده همراه Ctrl، Alt یا Shift بزنید.'; return; }
      pendingShortcut = s; $('recorder').textContent = shortcutLabel(s); feedback();
    };
    $('save-slot').onclick = () => {
      state.slots[i].name = $('slot-name').value.trim() || (state.slots[i].path ? state.slots[i].path.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') : '');
      state.slots[i].shortcut = pendingShortcut; save(); closeDialog(); render(); toast('تنظیمات پد ذخیره شد؛ وضعیت میان‌بر روی پد نمایش داده می‌شود.');
    };
    $('clear-key').onclick = () => { pendingShortcut = null; $('recorder').textContent = shortcutLabel(null); feedback(); };
    $('replace-slot').onclick = () => { closeDialog(); chooseAudio(i); };
    $('clear-slot').onclick = () => { stop(); state.slots[i] = {path: '', name: '', duration: 0, shortcut: state.slots[i].shortcut}; missing.delete(i); save(); closeDialog(); render(); };
    feedback(); showDialog();
  }
  function renameSlot(i) {
    $('dialog-body').innerHTML = '<h2 id="dialog-title">اسم این صدا چی باشه؟</h2><p>اسم دلخواهت روی پد و پخش‌کننده نمایش داده می‌شود.</p><form id="rename-form"><label for="rename-input">نام صدا</label><input id="rename-input" type="text" maxlength="80" dir="auto" autocomplete="off"><div class="dialog-actions"><button type="submit" class="primary">ذخیره اسم</button><button type="button" id="cancel-rename" class="secondary">انصراف</button></div></form>';
    $('rename-input').value = state.slots[i].name;
    $('rename-form').onsubmit = e => {
      e.preventDefault();
      const s = state.slots[i]; s.name = $('rename-input').value.trim() || (s.path ? s.path.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') : '');
      if (playing === i) $('now-playing').textContent = s.name;
      save(); closeDialog(); render(); toast('اسم صدا ذخیره شد.');
    };
    $('cancel-rename').onclick = closeDialog;
    showDialog();
  }
  async function refreshHost() {
    if (!isCEP || busy || !$('modal').hidden) return;
    try {
      const info = await host('SoundPrime.info()'); sequence = info.sequence;
      $('connection').textContent = sequence || 'NO ACTIVE SEQUENCE'; $('connection').title = sequence || '';
      $('connection-dot').classList.toggle('muted', !sequence);
      if (JSON.stringify(info.tracks) !== $('track').dataset.tracks) {
        $('track').dataset.tracks = JSON.stringify(info.tracks); $('track').textContent = '';
        info.tracks.forEach((name, i) => { const o = document.createElement('option'); o.value = i; o.textContent = 'A' + (i + 1) + ' · ' + name; $('track').append(o); });
      }
      $('track').value = String(state.track);
    } catch (e) { $('connection').textContent = 'PREMIERE NOT RESPONDING'; $('connection-dot').classList.add('muted'); }
  }
  $('import').onclick = () => chooseAudio(null);
  $('theme').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; save(); render(); };
  $('search').oninput = e => { searchQuery = e.target.value.trim().toLocaleLowerCase(); filterPads(); };
  document.querySelectorAll('[data-filter]').forEach(el => el.onclick = () => { activeFilter = el.dataset.filter; filterPads(); });
  $('audio-files').onchange = e => { pauseNative(false); addFiles(Array.from(e.target.files), importTarget); e.target.value = ''; };
  window.addEventListener('focus', () => { if ($('modal').hidden) pauseNative(false); });
  $('enabled').onclick = () => { state.enabled = !state.enabled; save(); render(); };
  $('stop').onclick = stop;
  $('preview-play').onclick = async () => {
    if (!audio) { if (lastPreview >= 0) preview(lastPreview); return; }
    const current = audio;
    try { if (current.paused) await current.play(); else current.pause(); updateMonitor(); }
    catch (e) { if (audio === current) { stop(); toast(e.message, true); } }
  };
  $('preview-position').oninput = e => {
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) { audio.currentTime = Number(e.target.value) / 1000 * audio.duration; updateMonitor(); }
  };
  $('volume').oninput = e => { state.volume = Number(e.target.value) / 100; $('volume-value').textContent = e.target.value + '%'; if (audio) audio.volume = state.volume; };
  $('volume').onchange = save;
  $('track').onchange = e => { state.track = Number(e.target.value); save(); };
  $('close-dialog').onclick = closeDialog;
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) closeDialog(); });
  document.addEventListener('keydown', e => {
    if (!$('modal').hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeDialog(); return; }
      if (e.key === 'Tab') {
        const els = Array.from($('modal').querySelectorAll('button:not(:disabled),input,[tabindex="0"]'));
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      if (dialogKeyHandler) dialogKeyHandler(e);
      return;
    }
    // Native companion handles CEP keypresses once, including when timeline has focus.
    if (isCEP || !state.enabled || e.repeat || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const shortcut = {key: e.keyCode, modifiers: (e.ctrlKey ? 2 : 0) | (e.altKey ? 1 : 0) | (e.shiftKey ? 4 : 0) | (isMac && e.metaKey ? 8 : 0)};
    const i = state.slots.findIndex(s => s.shortcut && Core.shortcutId(s.shortcut) === Core.shortcutId(shortcut));
    if (i >= 0) { e.preventDefault(); place(i); }
  }, true);
  $('help').onclick = () => {
    $('dialog-body').innerHTML = '<h2 id="dialog-title">OTINER</h2><ol><li>با «افزودن صدا» یا رها کردن فایل روی پد، تا ۹ ساند افکت انتخاب کن.</li><li>روی اسم هر پد بزن و نام دلخواهت را ذخیره کن. میان‌بر از سه‌نقطه تنظیم می‌شود.</li><li>روی موج یا «پریویو» بزن تا صدا را بشنوی؛ پخش‌کننده پایین پنل مکث، ادامه، توقف و جابه‌جایی داخل صدا دارد.</li><li>فایل KYS فعال پریمیر را برای بررسی تداخل وارد کن: Edit → Keyboard Shortcuts → Save As. فایل معمولاً در Documents/Adobe/Premiere Pro/24.0/Profile-…/Win است.</li><li>یک سکانس باز کن و ترک صوتی خالی را از TARGET انتخاب کن. نشانگر را جابه‌جا کن و «درج» یا میان‌بر صدا را بزن.</li></ol><p>پنل باید باز بماند. میان‌برها فقط هنگام فوکوس روی پریمیر فعال‌اند. روی ترک قفل‌شده یا بخش پُر صدا درج نمی‌شود. فایل‌های صدا جابه‌جا یا همراه بانک کپی نمی‌شوند.</p><p>بلندی VOL فقط پیش‌شنوی را تغییر می‌دهد. بانک و مسیر فایل‌ها روی همین سیستم ذخیره می‌شوند. اتصال اینترنت لازم نیست.</p><p>Premiere Pro 2024 روی Windows 10/11. برای Undo از Ctrl+Z خود پریمیر استفاده کن.</p>';
    if (isMac) $('dialog-body').innerHTML = $('dialog-body').innerHTML.replace('Edit → Keyboard Shortcuts', 'Premiere Pro → Keyboard Shortcuts').replace('Profile-…/Win', 'Profile-…/Mac').replace('Windows 10/11', 'macOS 12+').replace('Ctrl+Z', 'Cmd+Z');
    showDialog();
  };
  $('kys').onclick = () => { pauseNative(true); $('kys-file').click(); };
  $('kys-file').onchange = async e => {
    pauseNative(false); const f = e.target.files[0]; if (!f) return;
    try {
      const text = fs ? fs.readFileSync(f.path, 'utf8') : await f.text();
      const parsed = Core.parseKys(text, isMac); if (!Object.keys(parsed).length) throw new Error('این فایل هیچ میان‌بری ندارد.');
      kys = parsed; kysLoaded = true; state.kysPath = fs ? f.path : ''; save(); render();
      toast('میان‌برها با «' + f.name + '» بررسی شدند؛ فایل باید همان تنظیم فعال پریمیر باشد.');
    } catch (err) { toast(err.message, true); } finally { e.target.value = ''; }
  };
  $('export-bank').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'}), url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'OTINER-sound-bank.json';
    // CEP downloads are unreliable; use the native save dialog instead.
    if (isCEP && window.cep && window.cep.fs) {
      pauseNative(true);
      try {
        const dialog = window.cep.fs.showSaveDialogEx('Save sound bank', '', ['json'], 'OTINER-sound-bank.json');
        if (dialog.err === 0 && dialog.data) fs.writeFileSync(dialog.data, JSON.stringify(state, null, 2), 'utf8');
      } catch (e) { toast(e.message, true); } finally { pauseNative(false); }
    } else { document.body.append(a); a.click(); a.remove(); }
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $('import-bank').onclick = () => { pauseNative(true); $('bank-file').click(); };
  $('bank-file').onchange = async e => {
    pauseNative(false); const f = e.target.files[0]; if (!f) return;
    try {
      const next = Core.normalize(JSON.parse(fs ? fs.readFileSync(f.path, 'utf8') : await f.text()), isMac);
      stop(); state = next; peaks.clear(); missing.clear(); loadKys(); save(); render(); refreshHost(); toast('بانک صدا بازیابی شد. مسیر فایل‌ها باید روی این سیستم موجود باشد.');
    } catch (err) { toast(err.message, true); } finally { e.target.value = ''; }
  };
  window.addEventListener('beforeunload', () => {
    if (helper) helper.kill();
    if (fs && session) { try { fs.rmSync(session, { recursive: true, force: true }); } catch (e) {} }
    browserFiles.forEach(f => URL.revokeObjectURL(f.url));
  });
  readState(); loadKys(); render(); startHelper();
  if (!isCEP) $('connection').textContent = 'BROWSER PREVIEW';
  else refreshHost();
  setInterval(pollNative, 150); setInterval(refreshHost, 4000);
}());
