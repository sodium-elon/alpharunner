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
REQUIRED_REFERENCES = {
    'sportscoach-decisions': ('request-continuity-and-voice-evidence.md',),
    'running-coaching': ('coaching-evidence.md', 'stryd-power-coaching.md',
                         'john-shoe-rotation.md', 'shoe-rotation-evidence.md'),
    'alpharunner-garmin-run-import': ('import-evidence.md', 'telemetry-validation.md',
                                    'garmin-auth-recovery-recipe.md',
                                    'cli-and-db-query-pitfalls.md'),
}


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
    if not isinstance(previous, dict):
        parser.error('Invalid managed manifest')
    for relative in previous:
        parts = relative.split('/')
        if (len(parts) < 3 or parts[0] not in NAMES
                or parts[1] not in ('references', 'scripts')
                or any(part in ('', '.', '..') for part in parts)):
            if relative not in {f'{name}/SKILL.md' for name in NAMES}:
                parser.error(f'Invalid managed path: {relative}')
        target = args.profile_skills / relative
        for parent in target.parents:
            if parent == args.profile_skills:
                break
            if parent.is_symlink():
                parser.error(f'Unsafe managed parent: {relative}')
    manifest = {}
    copies = []
    for name in NAMES:
        source = (args.source / name).resolve()
        if not (source / 'SKILL.md').is_file():
            parser.error(f'Canonical entrypoint missing: {name}')
        for reference in REQUIRED_REFERENCES[name]:
            if not (source / 'references' / reference).is_file():
                parser.error(f'Canonical knowledge missing: {name}/references/{reference}')
        files = [source / 'SKILL.md']
        for folder in ('references', 'scripts'):
            files.extend(p for p in (source / folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
        for original in files:
            target = args.profile_skills / name / original.relative_to(source)
            relative = str(target.relative_to(args.profile_skills))
            for parent in target.parents:
                if parent == args.profile_skills:
                    break
                if parent.is_symlink():
                    parser.error(f'Unsafe managed parent: {relative}')
            manifest[relative] = hashlib.sha256(original.read_bytes()).hexdigest()
            if not target.is_symlink() and target.is_file() and target.read_bytes() == original.read_bytes():
                continue
            if args.verify:
                parser.error(f'Installed canonical file missing or divergent: {name}/{original.relative_to(source)}')
            if target.exists() and target.read_bytes() != original.read_bytes():
                if hashlib.sha256(target.read_bytes()).hexdigest() != previous.get(relative):
                    parser.error(f'Refusing divergent installed file: {name}/{original.relative_to(source)}')
            copies.append((original, target))
    removals = []
    for relative, expected_hash in previous.items():
        if relative in manifest:
            continue
        target = args.profile_skills / relative
        if not target.exists() and not target.is_symlink():
            continue
        if args.verify:
            parser.error(f'Retired managed file remains installed: {relative}')
        if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest() != expected_hash:
            parser.error(f'Refusing divergent retired file: {relative}')
        removals.append(target)
    # Preflight every copy and removal before changing any file or the manifest.
    for original, target in copies:
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() or target.is_symlink():
            target.unlink()
        shutil.copy2(original, target)
    for target in removals:
        target.unlink()
    if args.install:
        manifest_path.write_text(json.dumps(manifest, sort_keys=True, indent=2) + '\n')
    print(f'{"Installed" if args.install else "Verified"} {len(NAMES)} canonical Sportscoach skills')


if __name__ == '__main__':
    main()
