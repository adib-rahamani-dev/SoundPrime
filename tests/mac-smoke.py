"""CLI-only macOS checks. No Premiere project, keyboard injection or real user preferences."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parent.parent


def wait_for(predicate, timeout=7):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.1)
    raise AssertionError("Timed out waiting for companion state")


def companion_checks(temp):
    session = temp / "session"
    session.mkdir()
    beat = session / "heartbeat"
    beat.write_text("1")
    (session / "keys.tsv").write_text("0\t12\t49")
    process = subprocess.Popen([str(ROOT / "extension/bin/OTINER.Hotkeys"), str(session)])
    try:
        def first_status():
            status = session / "status.tsv"
            return status.exists() and status.read_text() in ("0\tavailable", "0\tunavailable")
        wait_for(first_status)
        (session / "keys.tsv").write_text("99\t12\t49\nbad\n1\t12\t50")
        wait_for(lambda: (session / "status.tsv").read_text().startswith("1\t"))
        assert "99\t" not in (session / "status.tsv").read_text()
        past = time.time() - 25
        os.utime(beat, (past, past))
        assert process.wait(timeout=4) == 0
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=4)
    print("Mac companion: native execution, protocol reload, invalid slot rejection and heartbeat shutdown passed.")


def installer_checks(temp):
    # A shim prevents defaults from touching the CI user's actual preferences.
    shim = temp / "shim"
    shim.mkdir()
    defaults = shim / "defaults"
    defaults.write_text("""#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
p = Path(os.environ['OTINER_TEST_PREFS'])
action = sys.argv[1]
if action in ('read', 'read-type'):
    if not p.exists(): sys.exit(1)
    saved=json.loads(p.read_text())
    print(saved['value'] if action=='read' else 'Type is '+saved['type'])
elif action=='write':
    types={'-string':'string','-int':'integer','-bool':'boolean'}
    p.write_text(json.dumps({'value':sys.argv[-1], 'type':types[sys.argv[-2]]}))
elif action=='delete': p.unlink(missing_ok=True)
else: sys.exit(1)
""")
    defaults.chmod(0o755)
    pgrep = shim / "pgrep"
    pgrep.write_text("#!/bin/sh\nif [ \"${OTINER_TEST_PREMIERE_RUNNING:-0}\" = 1 ]; then exit 0; fi\nexit 1\n")
    pgrep.chmod(0o755)
    for n, prior in enumerate([None, {"value": "0", "type": "integer"}, {"value": "false", "type": "boolean"}, {"value": "custom", "type": "string"}]):
        home = temp / f"home with spaces {n}"
        home.mkdir()
        prefs = temp / f"preferences-{n}.json"
        if prior is not None:
            prefs.write_text(json.dumps(prior))
        env = dict(os.environ, HOME=str(home), PATH=str(shim) + os.pathsep + os.environ["PATH"], OTINER_TEST_PREFS=str(prefs))
        install = ["/bin/bash", str(ROOT / "installer/install-mac.sh")]
        uninstall = ["/bin/bash", str(ROOT / "installer/uninstall-mac.sh")]
        subprocess.run(install, env=env, check=True)
        target = home / "Library/Application Support/Adobe/CEP/extensions/ir.oteener.soundprime"
        data = home / "Library/Application Support/OTINER"
        assert (target / "bin/OTINER.Hotkeys").is_file()
        assert json.loads(prefs.read_text()) == {"type": "string", "value": "1"}
        (data / "bank.json").write_text('{"keep":"bank"}')
        subprocess.run(install, env=env, check=True)
        assert len(list((data / "backups").iterdir())) == 1
        subprocess.run(uninstall, env=env, check=True)
        assert not target.exists()
        assert (data / "bank.json").read_text() == '{"keep":"bank"}'
        if prior is None:
            assert not prefs.exists()
        else:
            assert json.loads(prefs.read_text()) == prior
        blocked_env = dict(env, OTINER_TEST_PREMIERE_RUNNING="1")
        assert subprocess.run(install, env=blocked_env).returncode != 0
        assert not target.exists()
    print("Mac installer: spaced paths, reinstall/backup, removal, bank retention and preference restoration passed (isolated preference shim).")


if __name__ == "__main__":
    assert os.uname().sysname == "Darwin", "Run on macOS"
    with tempfile.TemporaryDirectory(prefix="otiner-mac-test-") as folder:
        temp = Path(folder)
        companion_checks(temp)
        installer_checks(temp)
