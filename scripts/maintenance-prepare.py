#!/usr/bin/env python3
"""Prepare an independent update candidate. Never install, launch, push or promote."""
import argparse
import datetime
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def git(*args, cwd=ROOT, check=True):
    return subprocess.run(["git", *args], cwd=cwd, check=check,
                          text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ref", help="Already fetched upstream commit/tag; no implicit network")
    parser.add_argument("--output-root", type=Path,
                        default=ROOT.parent / "pi-gui-maintenance-runs")
    args = parser.parse_args()
    if git("status", "--porcelain").stdout.strip():
        parser.error("Maintenance checkout must be clean")
    if git("branch", "--show-current").stdout.strip() != "maintenance/zh-cn":
        parser.error("Expected maintenance/zh-cn")
    base = git("rev-parse", "HEAD").stdout.strip()
    target = git("rev-parse", "--verify", "--end-of-options", args.ref + "^{commit}").stdout.strip()
    if git("merge-base", "--is-ancestor", target, base, check=False).returncode == 0:
        print(json.dumps({"status": "already-included", "base": base, "target": target}))
        return
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    run = args.output_root.expanduser().resolve() / stamp
    run.mkdir(parents=True, mode=0o700)
    checkout = run / "candidate"
    git("clone", "--no-hardlinks", "--no-checkout", str(ROOT), str(checkout))
    git("switch", "-c", "candidate/" + stamp, base, cwd=checkout)
    git("remote", "set-url", "--push", "origin", "DISABLED", cwd=checkout)
    result = git("merge", "--no-commit", "--no-ff", target, cwd=checkout, check=False)
    (run / "merge.log").write_text(result.stdout + result.stderr)
    status = "prepared-needs-validation" if result.returncode == 0 else "merge-blocked"
    manifest = {"status": status, "base": base, "target": target,
                "candidate": str(checkout), "validated": False, "installed": False}
    (run / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest))
    if result.returncode:
        raise SystemExit(2)

if __name__ == "__main__":
    main()
