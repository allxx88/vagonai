from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'").strip('"'))


load_dotenv()


def run(cmd: list[str], check: bool = True, capture: bool = False) -> str:
    result = subprocess.run(
        cmd,
        cwd=ROOT,
        text=True,
        capture_output=capture,
        check=False,
    )

    if check and result.returncode != 0:
        stderr = result.stderr.strip() if result.stderr else ""
        stdout = result.stdout.strip() if result.stdout else ""
        message = stderr or stdout or f"Command failed: {' '.join(cmd)}"
        raise RuntimeError(message)

    if capture:
        return result.stdout.strip()
    return ""


def get_remote_url(remote: str) -> str:
    return run(["git", "remote", "get-url", remote], capture=True)


def with_token(remote_url: str, token: str) -> str:
    parsed = urlsplit(remote_url)
    if parsed.scheme not in {"http", "https"}:
        raise RuntimeError("Token-based push supports only http/https remotes.")
    netloc = f"x-access-token:{token}@{parsed.netloc}"
    return urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))


def ensure_git_changes() -> None:
    status = run(["git", "status", "--short"], capture=True)
    if not status.strip():
        raise RuntimeError("No changes to commit.")


def current_branch() -> str:
    return run(["git", "branch", "--show-current"], capture=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build and deploy Hugo site to GitHub.")
    parser.add_argument(
        "--message",
        default="Deploy site updates",
        help="Git commit message",
    )
    parser.add_argument(
        "--branch",
        default=os.environ.get("GITHUB_DEPLOY_BRANCH", "main"),
        help="Git branch to push",
    )
    parser.add_argument(
        "--remote",
        default=os.environ.get("GIT_REMOTE", "origin"),
        help="Git remote name",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Skip hugo build before commit and push",
    )
    parser.add_argument(
        "--allow-other-branch",
        action="store_true",
        help="Allow running from a branch different from --branch",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned actions without git add/commit/push",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    branch = current_branch()
    if not args.allow_other_branch and branch != args.branch:
        raise RuntimeError(
            f"Current branch is '{branch}', expected '{args.branch}'. "
            "Use --allow-other-branch to override."
        )

    if not args.skip_build:
        run(["hugo", "--minify"])

    ensure_git_changes()

    if args.dry_run:
        print(f"Ready to deploy from branch '{branch}' to {args.remote}/{args.branch}")
        print(f"Commit message: {args.message}")
        print("Build step completed" if not args.skip_build else "Build step skipped")
        print("Dry run only: git add/commit/push not executed")
        return 0

    run(["git", "add", "-A"])
    run(["git", "commit", "-m", args.message])

    remote = args.remote
    token = os.environ.get("GITHUB_TOKEN")

    if token:
        remote_url = get_remote_url(remote)
        push_target = with_token(remote_url, token)
        run(["git", "push", push_target, f"HEAD:{args.branch}"])
    else:
        run(["git", "push", remote, args.branch])

    print(f"Deployed to {remote}/{args.branch}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
