/* ExtendScript: deliberately ES3-compatible. No QE/private Premiere APIs. */
var SoundPrime = (function () {
    function quote(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"'; }
    function fail(message) { return '{"ok":false,"error":' + quote(message) + '}'; }
    function find(parent, path) {
        if (!parent || !parent.children) return null;
        for (var i = 0; i < parent.children.numItems; i++) {
            var child = parent.children[i];
            if (child.type === ProjectItemType.BIN) { var nested = find(child, path); if (nested) return nested; }
            else if (child.getMediaPath && new File(child.getMediaPath()).fsName.toLowerCase() === path.toLowerCase()) return child;
        }
        return null;
    }
    function info() {
        try {
            var seq = app.project && app.project.activeSequence;
            if (!seq) return '{"ok":true,"sequence":null,"tracks":[]}';
            var tracks = [];
            for (var i = 0; i < seq.audioTracks.numTracks; i++) tracks.push(quote(seq.audioTracks[i].name || ('Audio ' + (i + 1))));
            return '{"ok":true,"sequence":' + quote(seq.name) + ',"tracks":[' + tracks.join(',') + ']}';
        } catch (e) { return fail(e.message); }
    }
    function place(path, trackIndex) {
        try {
            var seq = app.project && app.project.activeSequence;
            if (!seq) return fail('ابتدا یک سکانس در پریمیر باز کنید.');
            var file = new File(path);
            if (!file.exists) return fail('فایل صدا پیدا نشد؛ دوباره آن را انتخاب کنید.');
            if (!/\.(wav|mp3|aif|aiff|m4a|aac|flac|ogg)$/i.test(path)) return fail('فایل باید صوتی باشد.');
            if (trackIndex < 0 || trackIndex >= seq.audioTracks.numTracks || trackIndex !== Math.floor(trackIndex)) return fail('ترک صوتی انتخاب‌شده موجود نیست.');
            var track = seq.audioTracks[trackIndex];
            if (track.isLocked()) return fail('ترک صوتی قفل است.');
            var item = find(app.project.rootItem, file.fsName);
            if (!item) {
                var bin = null;
                for (var b = 0; b < app.project.rootItem.children.numItems; b++) {
                    var candidate = app.project.rootItem.children[b];
                    if (candidate.type === ProjectItemType.BIN && candidate.name === 'Oteener Sound Design') { bin = candidate; break; }
                }
                if (!bin) bin = app.project.rootItem.createBin('Oteener Sound Design');
                if (!app.project.importFiles([file.fsName], true, bin, false)) return fail('پریمیر نتوانست فایل را وارد کند.');
                item = find(bin, file.fsName);
            }
            if (!item) return fail('صدای واردشده در پروژه پیدا نشد.');
            var mapping = item.getAudioChannelMapping();
            if (!mapping || mapping.audioClipsNumber !== 1 || (mapping.audioChannelsType !== 0 && mapping.audioChannelsType !== 1))
                return fail('برای درج امن، صدا باید یک کلیپ مونو یا استریو باشد؛ تنظیم Audio Channels منبع را بررسی کنید.');
            var start = seq.getPlayerPosition().seconds;
            var duration = item.getOutPoint(2).seconds - item.getInPoint(2).seconds;
            if (!(duration > 0) || !isFinite(duration)) return fail('مدت صدای منبع مشخص نیست.');
            var frameDuration = Number(seq.timebase) / 254016000000;
            if (!(frameDuration > 0)) return fail('نرخ فریم سکانس مشخص نیست.');
            var protectedDuration = Math.ceil((duration - 0.0000001) / frameDuration) * frameDuration;
            // Never overwrite an existing clip or ripple the rest of the sequence.
            for (var c = 0; c < track.clips.numItems; c++) {
                var clip = track.clips[c];
                if (clip.start.seconds < start + protectedDuration - 0.000001 && clip.end.seconds > start + 0.000001)
                    return fail('این بخش از ترک خالی نیست؛ ترک دیگری انتخاب کنید.');
            }
            var before = track.clips.numItems;
            track.overwriteClip(item, start);
            if (track.clips.numItems <= before) return fail('درج صدا تأیید نشد؛ سازگاری کانال‌های صدا و ترک را بررسی کنید.');
            return '{"ok":true,"name":' + quote(item.name) + '}';
        } catch (e) { return fail(e.message); }
    }
    try { app.setExtensionPersistent('ir.oteener.soundprime.panel', 1); } catch (e) {}
    return { info: info, place: place };
}());
