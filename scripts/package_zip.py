#!/usr/bin/env python3
"""Package the Behance → PDF project as a Vercel-deployable ZIP."""
import os
import zipfile
from pathlib import Path

ROOT = Path("/home/z/my-project")
OUT = Path("/home/z/my-project/download/behance-to-pdf.zip")

# Directories and files to NEVER include in the zip.
EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    ".zscripts",
    ".git",
    "download",
    "upload",
    "skills",
    "tests",
    "examples",
    "mini-services",
    "db",
    "prisma",
    ".turbo",
    ".cache",
    "out",
}
EXCLUDE_FILES = {
    "dev.log",
    "server.log",
    "next-env.d.ts",  # auto-generated on build
    ".DS_Store",
    "bun.lock",  # lockfile — keep actually, see below
}
# We DO want to keep bun.lock so installs are reproducible.
EXCLUDE_FILES.discard("bun.lock")

# Patterns to exclude by suffix.
EXCLUDE_SUFFIXES = {".log", ".pid"}


def should_exclude(rel_path: Path) -> bool:
    parts = rel_path.parts
    if not parts:
        return True
    # Exclude if any path component is in EXCLUDE_DIRS.
    for part in parts:
        if part in EXCLUDE_DIRS:
            return True
    if rel_path.name in EXCLUDE_FILES:
        return True
    if rel_path.suffix in EXCLUDE_SUFFIXES:
        return True
    # Exclude hidden dotfiles (e.g. .DS_Store, .eslintcache).
    if rel_path.name.startswith(".") and rel_path.name not in {".gitignore", ".nvmrc", ".env.example"}:
        return True
    return False


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        OUT.unlink()
    file_count = 0
    total_bytes = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for dirpath, dirnames, filenames in os.walk(ROOT):
            # Prune excluded dirs in-place so os.walk doesn't descend into them.
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS and not d.startswith(".git")]
            for fname in filenames:
                abs_path = Path(dirpath) / fname
                rel_path = abs_path.relative_to(ROOT)
                if should_exclude(rel_path):
                    continue
                # Use arcname with a top-level "behance-to-pdf/" folder so
                # unzipping creates a clean project directory.
                arcname = Path("behance-to-pdf") / rel_path
                zf.write(abs_path, arcname=str(arcname))
                file_count += 1
                total_bytes += abs_path.stat().st_size
    zip_size = OUT.stat().st_size
    print(f"Wrote {OUT}")
    print(f"Files: {file_count}")
    print(f"Uncompressed size: {total_bytes / 1024 / 1024:.2f} MB")
    print(f"Compressed size:   {zip_size / 1024 / 1024:.2f} MB")
    # List a few top-level entries to sanity check.
    with zipfile.ZipFile(OUT, "r") as zf:
        names = zf.namelist()
        print("\nTop-level entries in zip:")
        seen = set()
        for n in names:
            top = n.split("/")[1] if "/" in n else n
            if top not in seen and "/" not in n.rstrip("/"):
                seen.add(top)
        # Just list the first few arc paths.
        for n in names[:20]:
            print(f"  {n}")
        print(f"  ... ({len(names)} total entries)")


if __name__ == "__main__":
    main()
