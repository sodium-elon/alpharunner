"""Install/verify Sportscoach's canonical skill entrypoints and supporting files.

Local skill names take precedence over external_dirs in Hermes discovery.
Install byte-verified snapshots inside each skill root: external file symlinks
are rejected by Hermes's reference-path sandbox. The repo remains canonical;
--verify detects drift and --install refuses divergent installed knowledge.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

NAMES = ('sportscoach-decisions', 'running-coaching', 'alpharunner-garmin-run-import')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--install', action='store_true')
    mode.add_argument('--verify', action='store_true')
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[1] / 'skills')
    parser.add_argument('--profile-skills', type=Path,
                        default=Path.home() / '.hermes/profiles/sportscoach/skills')
    args = parser.parse_args()
    manifest_path = args.profile_skills / '.sportscoach-install.json'
    previous = json.loads(manifest_path.read_text()) if manifest_path.is_file() else {}
    manifest = {}
    copies = []
    for name in NAMES:
        source = (args.source / name).resolve()
        if not (source / 'SKILL.md').is_file():
            parser.error(f'Canonical entrypoint missing: {name}')
        if name != 'sportscoach-decisions' and not (source / 'references/legacy-workflow.md').is_file():
            parser.error(f'Canonical knowledge missing: {name}/references/legacy-workflow.md')
        files = [source / 'SKILL.md']
        for folder in ('references', 'scripts'):
            files.extend(p for p in (source / folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
        for original in files:
            target = args.profile_skills / name / original.relative_to(source)
            relative = str(target.relative_to(args.profile_skills))
            manifest[relative] = hashlib.sha256(original.read_bytes()).hexdigest()
            if not target.is_symlink() and target.is_file() and target.read_bytes() == original.read_bytes():
                continue
            if args.verify:
                parser.error(f'Installed canonical file missing or divergent: {name}/{original.relative_to(source)}')
            if target.exists() and target.read_bytes() != original.read_bytes():
                if hashlib.sha256(target.read_bytes()).hexdigest() != previous.get(relative):
                    parser.error(f'Refusing divergent installed file: {name}/{original.relative_to(source)}')
            copies.append((original, target))
    # Validate every file before changing any installed file.
    for original, target in copies:
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() or target.is_symlink():
            target.unlink()
        shutil.copy2(original, target)
    if args.install:
        manifest_path.write_text(json.dumps(manifest, sort_keys=True, indent=2) + '\n')
    print(f'{"Installed" if args.install else "Verified"} {len(NAMES)} canonical Sportscoach skills')


if __name__ == '__main__':
    main()
