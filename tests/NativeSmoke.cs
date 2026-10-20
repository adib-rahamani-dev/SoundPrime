using System;
using System.IO;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

internal static class NativeSmoke {
    [DllImport("user32.dll", SetLastError=true)] static extern bool RegisterHotKey(IntPtr h, int id, uint modifiers, uint key);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr h, int id);
    static void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
    static bool WaitFor(Func<bool> predicate) {
        for (int i=0; i<65; i++) { if (predicate()) return true; Thread.Sleep(100); }
        return false;
    }
    static bool HasStatus(string dir, string expected) {
        try { return File.ReadAllText(Path.Combine(dir, "status.tsv")).Contains(expected); } catch (IOException) { return false; }
    }
    static int Main(string[] args) {
        string dir = Path.Combine(Path.GetTempPath(), "soundprime-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir); Process helper = null; bool held = false;
        try {
            uint key = 57;
            held = RegisterHotKey(IntPtr.Zero, 77, 7, key);
            Require(held, "Test combination Ctrl+Alt+Shift+9 is already occupied.");
            File.WriteAllText(Path.Combine(dir, "heartbeat"), "1");
            File.WriteAllText(Path.Combine(dir, "keys.tsv"), "0\t7\t57");
            helper = Process.Start(new ProcessStartInfo(args[0], "\"" + dir + "\"") { UseShellExecute = false, CreateNoWindow = true });
            Require(WaitFor(delegate { return HasStatus(dir, "0\tconflict"); }), "Companion failed to detect a real Windows hotkey conflict.");
            UnregisterHotKey(IntPtr.Zero, 77); held = false;
            Require(WaitFor(delegate { return HasStatus(dir, "0\tavailable"); }), "Companion failed to recover after conflicting registration was released.");
            held = RegisterHotKey(IntPtr.Zero, 77, 7, key);
            Require(held, "Companion held a key while Premiere was not focused.");
            UnregisterHotKey(IntPtr.Zero, 77); held = false;
            File.WriteAllText(Path.Combine(dir, "keys.tsv"), "malformed\n99\t7\t57\n1\t7\t56");
            Require(WaitFor(delegate { return HasStatus(dir, "1\tavailable"); }), "Live config reload failed.");
            Require(!HasStatus(dir, "99\t"), "Out-of-range pad was registered.");
            File.SetLastWriteTimeUtc(Path.Combine(dir, "heartbeat"), DateTime.UtcNow.AddSeconds(-25));
            Require(helper.WaitForExit(3500), "Companion did not exit after its panel heartbeat expired.");
            Console.WriteLine("Native smoke passed: actual Windows conflict, conflict recovery, release outside Premiere, live config reload, invalid input, heartbeat shutdown.");
            return 0;
        } catch (Exception e) { Console.Error.WriteLine(e.Message); return 1; }
        finally {
            if (held) UnregisterHotKey(IntPtr.Zero, 77);
            if (helper != null) { if (!helper.HasExited) helper.Kill(); helper.Dispose(); }
            // Delete exactly the unique directory allocated by this test, under the OS temp directory.
            if (Path.GetDirectoryName(Path.GetFullPath(dir)).TrimEnd(Path.DirectorySeparatorChar) == Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar)
                && Path.GetFileName(dir).StartsWith("soundprime-test-")) Directory.Delete(dir, true);
        }
    }
}
