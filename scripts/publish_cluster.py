from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
SCRIPTS_DIR = SCRIPT_DIR


def run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, cwd=ROOT, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Command failed with exit code {result.returncode}: {' '.join(cmd)}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate a blog cluster and deploy it to GitHub Pages."
    )
    parser.add_argument("--batch", type=int, required=True, help="Batch id from seo_blog.py plan output")
    parser.add_argument(
        "--message",
        default=None,
        help="Git commit message for deploy.py",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing generated markdown files",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate content and run deploy dry-run instead of commit/push",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Pass through to deploy.py to skip hugo --minify",
    )
    parser.add_argument(
        "--allow-other-branch",
        action="store_true",
        help="Pass through to deploy.py",
    )
    parser.add_argument(
        "--branch",
        default=None,
        help="Pass through branch target to deploy.py",
    )
    parser.add_argument(
        "--remote",
        default=None,
        help="Pass through remote name to deploy.py",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    generate_cmd = [sys.executable, str(SCRIPTS_DIR / "seo_blog.py"), "generate", "--batch", str(args.batch)]
    if args.overwrite:
        generate_cmd.append("--overwrite")

    commit_message = args.message or f"Publish blog batch {args.batch}"
    deploy_cmd = [sys.executable, str(SCRIPTS_DIR / "deploy.py"), "--message", commit_message]

    if args.dry_run:
        deploy_cmd.append("--dry-run")
    if args.skip_build:
        deploy_cmd.append("--skip-build")
    if args.allow_other_branch:
        deploy_cmd.append("--allow-other-branch")
    if args.branch:
        deploy_cmd.extend(["--branch", args.branch])
    if args.remote:
        deploy_cmd.extend(["--remote", args.remote])

    print(f"Generating cluster batch {args.batch}...")
    run(generate_cmd)
    print("Generation completed.")

    print("Starting deploy step...")
    run(deploy_cmd)
    print("Publish workflow completed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
