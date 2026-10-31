"""Source-owned Sportscoach capability policy, applied through Hermes config edit."""
from copy import deepcopy
import argparse
import json
import os
from pathlib import Path
import tempfile
from uuid import uuid4


def _names(value, field):
    if not isinstance(value, list) or any(not isinstance(x, str) or not x.strip() for x in value):
        raise ValueError('Invalid list: ' + field)
    return list(dict.fromkeys(value))


def desired_config(config, policy):
    if not isinstance(config, dict) or policy.get('profile') != 'sportscoach':
        raise ValueError('Expected Sportscoach configuration and policy')
    result = deepcopy(config)
    allowed = _names(policy['allowed_toolsets'], 'allowed_toolsets')
    disabled = _names(policy['disabled_toolsets'], 'disabled_toolsets')
    if not {'terminal', 'file', 'skills', 'web', 'homeassistant'} <= set(allowed) or set(allowed) & set(disabled):
        raise ValueError('Policy removes required domain capabilities or contradicts itself')
    platforms = result.setdefault('platform_toolsets', {})
    agent = result.setdefault('agent', {})
    if not isinstance(platforms, dict) or not isinstance(agent, dict):
        raise ValueError('Expected platform_toolsets and agent mappings')
    if 'no_mcp' not in allowed or any(x.startswith('mcp') for x in allowed):
        raise ValueError('Policy must disable automatic MCP discovery')
    legacy_bundles = set(_names(policy['approved_legacy_bundles'], 'approved_legacy_bundles'))
    recognized = set(allowed) | set(disabled) | legacy_bundles | set(
        _names(policy['approved_retired_native_toolsets'], 'approved_retired_native_toolsets'))
    selections = list(platforms.items())
    if 'toolsets' in result:
        selections.append(('toolsets', result['toolsets']))
    for name, value in selections:
        selection = set(_names(value, str(name)))
        if selection - recognized or any(x.startswith('mcp') for x in selection):
            raise ValueError('Unrecognized or explicit MCP selection requires source policy review')
        if not selection & legacy_bundles and not set(allowed) - {'no_mcp'} <= selection:
            raise ValueError('Existing platform restriction conflicts with domain capabilities')
    for name in sorted(set(platforms) | set(_names(policy['platforms'], 'platforms'))):
        platforms[name] = list(allowed)
    result['toolsets'] = list(allowed)
    previous_disabled = _names(agent.get('disabled_toolsets', []), 'agent.disabled_toolsets')
    if set(previous_disabled) & set(allowed):
        raise ValueError('Existing tool restriction conflicts with required domain capabilities')
    agent['disabled_toolsets'] = list(dict.fromkeys(previous_disabled + disabled))
    agent['coding_context'] = 'off'
    skills = result.setdefault('skills', {})
    if not isinstance(skills, dict):
        raise ValueError('Expected skills mapping')
    hidden = list(dict.fromkeys(_names(skills.get('disabled', []), 'skills.disabled')
                                + _names(policy['disabled_skills'], 'disabled_skills')))
    if set(_names(list(policy['required_skill_paths']), 'required_skill_paths')) & set(hidden):
        raise ValueError('Required domain skill is disabled')
    platform_hidden = skills.get('platform_disabled', {})
    if not isinstance(platform_hidden, dict):
        raise ValueError('Expected skills.platform_disabled mapping')
    for platform, names in platform_hidden.items():
        if not isinstance(platform, str) or not platform.strip():
            raise ValueError('Invalid skills.platform_disabled platform')
        names = _names(names, 'skills.platform_disabled.' + platform)
        if platform in platforms and set(policy['required_skill_paths']) & set(names):
            raise ValueError('Required domain skill is disabled on platform: ' + platform)
    skills['disabled'] = hidden
    skills['write_approval'] = True
    return result


def changed_fields(config, expected):
    fields = [('toolsets',), ('platform_toolsets',), ('agent', 'disabled_toolsets'),
              ('agent', 'coding_context'), ('skills', 'disabled'), ('skills', 'write_approval')]
    def value(doc, path):
        for part in path:
            if not isinstance(doc, dict):
                return None
            doc = doc.get(part)
        return doc
    return ['.'.join(path) for path in fields if value(config, path) != value(expected, path)]


def main():
    import yaml  # Available in the Hermes interpreter; CI installs the pinned dependency.
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--verify', action='store_true')
    mode.add_argument('--editor', type=Path, help='Hermes config edit callback; Sportscoach only')
    parser.add_argument('--config', type=Path,
                        default=Path.home() / '.hermes/profiles/sportscoach/config.yaml')
    args = parser.parse_args()
    path = args.editor or args.config
    expected_path = Path.home() / '.hermes/profiles/sportscoach/config.yaml'
    if args.editor and (path.is_symlink() or path.resolve() != expected_path.resolve()):
        parser.exit(2, 'Editor may only modify the Sportscoach profile config\n')
    try:
        policy = json.loads((Path(__file__).resolve().parents[1] / 'deploy/sportscoach-profile-policy.json').read_text())
        original = path.read_bytes()
        config = yaml.safe_load(original)
        desired = desired_config(config, policy)
        changes = changed_fields(config, desired)
        if args.editor and changes:
            backups = path.parent / 'state/config-backups'
            backups.mkdir(parents=True, exist_ok=True, mode=0o700)
            saved = backups / f'sportscoach-profile-policy-{uuid4().hex}.yaml'
            with os.fdopen(os.open(saved, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as handle:
                handle.write(original)
            fd, temporary = tempfile.mkstemp(prefix='.sportscoach-profile-policy-', dir=path.parent)
            try:
                with os.fdopen(fd, 'w') as handle:
                    handle.write(yaml.safe_dump(desired, sort_keys=False, allow_unicode=True))
                # Refuse a concurrent update; never overwrite newer local knowledge/config.
                if path.read_bytes() != original:
                    raise ValueError('Configuration changed concurrently')
                os.replace(temporary, path)
                if yaml.safe_load(path.read_bytes()) != desired:
                    raise ValueError('Configuration readback differs from policy')
            finally:
                Path(temporary).unlink(missing_ok=True)
    except (OSError, ValueError, KeyError, TypeError, yaml.YAMLError):
        parser.exit(2, 'Unable to verify/apply Sportscoach profile policy; check source contract/configuration format\n')
    if changes and args.verify:
        parser.exit(2, 'Sportscoach profile policy drift: ' + ', '.join(changes) + '\n')
    if args.verify:
        root = path.parent / 'skills'
        for name, relative in policy['required_skill_paths'].items():
            target = root / relative
            try:
                text = target.read_text() if target.resolve().is_relative_to(root.resolve()) else ''
                header = yaml.safe_load(text.split('---', 2)[1]) if text.startswith('---\n') else None
            except (OSError, ValueError, IndexError, yaml.YAMLError):
                header = None
            if not isinstance(header, dict) or header.get('name') != name:
                parser.exit(2, 'Missing or invalid required domain skill: ' + name + '\n')
    print('Saved Sportscoach profile policy; verify installed skills before activation'
          if args.editor else 'Verified Sportscoach profile capability and learning policy')


if __name__ == '__main__':
    main()
