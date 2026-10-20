using System;
using System.IO;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Collections.Generic;

// A local, session-scoped companion. No network, hooks, telemetry or startup entry.
internal sealed class HotkeyHost : NativeWindow, IDisposable {
    [DllImport("user32.dll", SetLastError=true)] static extern bool RegisterHotKey(IntPtr h, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr h, int id);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    readonly string folder;
    readonly Timer timer = new Timer();
    readonly Dictionary<int, uint[]> keys = new Dictionary<int, uint[]>();
    readonly HashSet<int> registered = new HashSet<int>();
    string lastConfig = "", lastStatus = "";
    bool active;
    DateTime lastProbe = DateTime.MinValue;

    public HotkeyHost(string dir) {
        folder = dir;
        CreateHandle(new CreateParams());
        timer.Interval = 100;
        timer.Tick += delegate { Tick(); };
        timer.Start();
        Tick();
    }
    bool PremiereFocused() {
        try {
            uint pid; GetWindowThreadProcessId(GetForegroundWindow(), out pid);
            using (var process = Process.GetProcessById((int)pid)) return process.ProcessName.Equals("Adobe Premiere Pro", StringComparison.OrdinalIgnoreCase);
        } catch { return false; }
    }
    void Release() {
        foreach (int id in registered) UnregisterHotKey(Handle, id);
        registered.Clear();
    }
    void Tick() {
        try {
            string beat = Path.Combine(folder, "heartbeat");
            if (!File.Exists(beat) || (DateTime.UtcNow - File.GetLastWriteTimeUtc(beat)).TotalSeconds > 15) { Application.ExitThread(); return; }
            string config = File.ReadAllText(Path.Combine(folder, "keys.tsv"));
            if (File.Exists(Path.Combine(folder, "paused"))) { Release(); active = false; return; }
            bool focused = PremiereFocused();
            bool changed = config != lastConfig || focused != active;
            if (changed) {
                Release(); keys.Clear();
                foreach (string line in config.Split('\n')) {
                    string[] p = line.Trim().Split('\t');
                    int id; uint mod, key;
                    if (p.Length == 3 && Int32.TryParse(p[0], out id) && UInt32.TryParse(p[1], out mod) && UInt32.TryParse(p[2], out key)
                        && id >= 0 && id < 9 && mod > 0 && mod <= 7 && ((key >= 48 && key <= 57) || (key >= 65 && key <= 90) || (key >= 112 && key <= 123))) keys[id] = new uint[] { mod, key };
                }
                active = focused; lastConfig = config;
            }
            if (!changed && (DateTime.UtcNow - lastProbe).TotalSeconds < 2) return;
            lastProbe = DateTime.UtcNow;
            var status = new List<string>();
            foreach (var pair in keys) {
                bool ok = registered.Contains(pair.Key);
                if (!ok) {
                    ok = RegisterHotKey(Handle, pair.Key, pair.Value[0] | 0x4000, pair.Value[1]);
                    if (ok) {
                        if (active) registered.Add(pair.Key);
                        else UnregisterHotKey(Handle, pair.Key);
                    }
                }
                status.Add(pair.Key + "\t" + (ok ? (active ? "active" : "available") : "conflict"));
            }
            string output = String.Join("\n", status.ToArray());
            if (output != lastStatus || !File.Exists(Path.Combine(folder, "status.tsv"))) {
                File.WriteAllText(Path.Combine(folder, "status.tmp"), output);
                string destination = Path.Combine(folder, "status.tsv");
                if (File.Exists(destination)) File.Delete(destination);
                File.Move(Path.Combine(folder, "status.tmp"), destination);
                lastStatus = output;
            }
        } catch (IOException) { } catch (UnauthorizedAccessException) { Application.ExitThread(); }
    }
    protected override void WndProc(ref Message m) {
        if (m.Msg == 0x0312 && active && PremiereFocused()) {
            try {
                // Pause is written before the shortcut recorder or any native dialog opens.
                if (!File.Exists(Path.Combine(folder, "paused"))) {
                    string eventPath = Path.Combine(folder, "event-" + DateTime.UtcNow.Ticks + "-" + Guid.NewGuid().ToString("N"));
                    File.WriteAllText(eventPath + ".tmp", m.WParam.ToInt32().ToString());
                    File.Move(eventPath + ".tmp", eventPath + ".txt");
                }
            } catch (IOException) { }
        }
        base.WndProc(ref m);
    }
    public void Dispose() { timer.Stop(); timer.Dispose(); Release(); DestroyHandle(); }
    [STAThread] static void Main(string[] args) {
        if (args.Length != 1 || !Directory.Exists(args[0])) return;
        using (var host = new HotkeyHost(args[0])) Application.Run();
    }
}
