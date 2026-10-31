import importlib.util
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('profile_policy', ROOT / 'scripts/sportscoach_profile_policy.py')
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
POLICY = json.loads((ROOT / 'deploy/sportscoach-profile-policy.json').read_text())


class ProfilePolicyTest(unittest.TestCase):
    def test_domain_toolsets_remove_unrelated_execution_across_all_platforms(self):
        original = {'platform_toolsets': {'discord': ['hermes-cli', 'spotify', 'delegation'],
                                         'future_platform': ['hermes-cli', 'computer_use']},
                    'model': {'provider': 'unchanged'}, 'gateway': {'opaque': 'unchanged'}}
        result = module.desired_config(original, POLICY)
        for platform in set(POLICY['platforms']) | {'future_platform'}:
            self.assertEqual(result['platform_toolsets'][platform], POLICY['allowed_toolsets'])
        self.assertEqual(result['toolsets'], POLICY['allowed_toolsets'])
        self.assertEqual(result['agent']['disabled_toolsets'], POLICY['disabled_toolsets'])
        self.assertEqual(result['model'], original['model'])
        self.assertEqual(result['gateway'], original['gateway'])
        self.assertEqual(original['platform_toolsets']['discord'], ['hermes-cli', 'spotify', 'delegation'])


    def test_platform_restrictions_fail_closed_and_mcp_is_opt_in(self):
        native = [x for x in POLICY['allowed_toolsets'] if x != 'no_mcp']
        for selection in [[], ['web'], ['no_mcp', 'web'],
                          native + ['mcp_private'], ['hermes-cli', 'mcp_private'],
                          native + ['private_server'], ['hermes-cli', 'private_server'],
                          'web', None]:
            for field in ['platform_toolsets', 'toolsets']:
                original = {field: {'telegram': selection} if field == 'platform_toolsets' else selection}
                with self.subTest(original=original):
                    before = json.dumps(original)
                    with self.assertRaises(ValueError):
                        module.desired_config(original, POLICY)
                    self.assertEqual(json.dumps(original), before)
        self.assertIn('no_mcp', POLICY['allowed_toolsets'])
        for selection in [native + ['spotify'], native + ['no_mcp'],
                          ['hermes-cli'], ['hermes-telegram', 'no_mcp']]:
            result = module.desired_config({'platform_toolsets': {'telegram': selection}}, POLICY)
            self.assertEqual(result['platform_toolsets']['telegram'], POLICY['allowed_toolsets'])
            self.assertEqual(module.desired_config(result, POLICY), result)

    def test_platform_disabled_required_skills_fail_closed(self):
        for disabled in [[], None, {'telegram': 'running-coaching'},
                         {'telegram': ['running-coaching']},
                         {'future_platform': ['running-coaching']}]:
            original = {'platform_toolsets': {'future_platform': ['hermes-cli']},
                        'skills': {'platform_disabled': disabled}}
            with self.subTest(disabled=disabled):
                before = json.dumps(original)
                with self.assertRaises(ValueError):
                    module.desired_config(original, POLICY)
                self.assertEqual(json.dumps(original), before)
        original = {'skills': {'platform_disabled': {'telegram': ['unrelated']}}}
        self.assertEqual(module.desired_config(original, POLICY)['skills']['platform_disabled'],
                         original['skills']['platform_disabled'])

    def test_verify_rejects_platform_disabled_even_with_installed_skills(self):
        import yaml
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'config.yaml'
            config = module.desired_config({}, POLICY)
            config['skills']['platform_disabled'] = {'telegram': ['running-coaching']}
            path.write_text(yaml.safe_dump(config))
            before = path.read_bytes()
            for name, relative in POLICY['required_skill_paths'].items():
                target = path.parent / 'skills' / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(f'---\nname: {name}\n---\nFixture.\n')
            result = subprocess.run([sys.executable, '-B', str(ROOT / 'scripts/sportscoach_profile_policy.py'),
                                     '--verify', '--config', str(path)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
            self.assertEqual(path.read_bytes(), before)

    def test_installed_edit_config_executes_single_path_wrapper(self):
        # Exercise the actual installed function without importing its startup side effects.
        # Only external config/managed boundaries are substituted; subprocess is real.
        import ast
        import yaml
        installed = Path('/home/john/.hermes/hermes-agent/hermes_cli/config.py')
        if not installed.is_file():
            self.skipTest('Installed Hermes edit_config integration requires the release host')
        source = installed.read_text()
        function = next(n for n in ast.parse(source).body
                        if isinstance(n, ast.FunctionDef) and n.name == 'edit_config')
        with tempfile.TemporaryDirectory(prefix='sportscoach editor ') as directory:
            home = Path(directory)
            path = home / '.hermes/profiles/sportscoach/config.yaml'
            path.parent.mkdir(parents=True)
            path.write_text('{}\n')
            wrapper = ROOT / 'scripts/sportscoach-profile-policy-editor'
            self.assertTrue(wrapper.is_file(), 'Executable source editor wrapper is missing')
            self.assertTrue(os.access(wrapper, os.X_OK), 'Wrapper must be executable')
            from unittest.mock import patch
            env = dict(os.environ, HOME=str(home), HERMES_HOME=str(path.parent), EDITOR=str(wrapper))
            namespace = {'os': os, 'subprocess': subprocess, 'is_managed': lambda: False,
                         'get_config_path': lambda: path}
            exec(compile(ast.Module(body=[function], type_ignores=[]), str(installed), 'exec'), namespace)
            with patch.dict(os.environ, env, clear=True):
                namespace['edit_config']()
            self.assertEqual(yaml.safe_load(path.read_bytes()), module.desired_config({}, POLICY))
            backups = list((path.parent / 'state/config-backups').glob('*'))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_bytes(), b'{}\n')
            for args in [[], [str(path), 'extra']]:
                result = subprocess.run([str(wrapper)] + args, env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 2, result.stdout + result.stderr)

    def test_reviewed_legacy_template_aliases_migrate_but_unknown_bundles_fail(self):
        legacy = ['hermes-cli', 'hermes-homeassistant', 'hermes-whatsapp',
                  'hermes-slack', 'hermes-signal', 'hermes-qqbot',
                  'hermes-yuanbao', 'hermes-teams', 'hermes-google_chat']
        original = {'platform_toolsets': {str(i): [name, 'spotify']
                                         for i, name in enumerate(legacy)}}
        before = json.dumps(original)
        result = module.desired_config(original, POLICY)
        for platform in original['platform_toolsets']:
            self.assertEqual(result['platform_toolsets'][platform], POLICY['allowed_toolsets'])
        self.assertEqual(json.dumps(original), before)
        with self.assertRaises(ValueError):
            module.desired_config({'platform_toolsets': {'future': ['hermes-unknown']}}, POLICY)

    def test_learning_stages_writes_and_hides_conflicting_maintenance_skills(self):
        original = {'skills': {'disabled': ['personal-disabled'], 'external_dirs': ['/retained/research']},
                    'agent': {'disabled_toolsets': ['personal-restriction'], 'max_turns': 150}}
        result = module.desired_config(original, POLICY)
        self.assertEqual(result['agent']['coding_context'], 'off')
        self.assertTrue(result['skills']['write_approval'])
        self.assertTrue(set(POLICY['disabled_skills']) <= set(result['skills']['disabled']))
        self.assertIn('personal-disabled', result['skills']['disabled'])
        self.assertIn('personal-restriction', result['agent']['disabled_toolsets'])
        self.assertEqual(result['skills']['external_dirs'], original['skills']['external_dirs'])
        self.assertEqual(result['agent']['max_turns'], 150)
        self.assertEqual(module.desired_config(result, POLICY), result)


    def test_conflicting_or_malformed_existing_restrictions_fail_closed(self):
        for original in [
            {'skills': {'disabled': ['running-coaching']}},
            {'agent': {'disabled_toolsets': ['terminal']}},
            {'skills': []}, {'platform_toolsets': []}, {'agent': []},
        ]:
            with self.subTest(original=original):
                before = json.dumps(original, sort_keys=True)
                with self.assertRaises(ValueError):
                    module.desired_config(original, POLICY)
                self.assertEqual(json.dumps(original, sort_keys=True), before)

    def test_verify_requires_installed_domain_skills_after_config_converges(self):
        import yaml
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'config.yaml'
            path.write_text(yaml.safe_dump(module.desired_config({}, POLICY)))
            command = [sys.executable, '-B', str(ROOT / 'scripts/sportscoach_profile_policy.py'),
                       '--verify', '--config', str(path)]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
            self.assertIn('required domain skill', result.stderr)
            for name, relative in POLICY['required_skill_paths'].items():
                target = path.parent / 'skills' / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(f'---\nname: {name}\ndescription: fixture\n---\nFixture knowledge.\n')
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_cli_verify_is_readonly_and_detects_current_permissive_policy(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'config.yaml'
            original = b'{"model":{"opaque":"must-remain-private"},"skills":{},"agent":{}}'
            path.write_bytes(original)
            result = subprocess.run([sys.executable, '-B', str(ROOT / 'scripts/sportscoach_profile_policy.py'),
                                     '--verify', '--config', str(path)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
            self.assertEqual(path.read_bytes(), original)
            self.assertNotIn('must-remain-private', result.stdout + result.stderr)
            self.assertIn('profile policy drift', result.stderr)


    def test_editor_scoped_backup_idempotence_and_foreign_profile_refusal(self):
        import yaml
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            path = home / '.hermes/profiles/sportscoach/config.yaml'
            path.parent.mkdir(parents=True)
            original = {'model': {'opaque': 'must-remain-private'}, 'skills': {}, 'agent': {}}
            path.write_text(yaml.safe_dump(original))
            before = path.read_bytes()
            command = [sys.executable, '-B', str(ROOT / 'scripts/sportscoach_profile_policy.py'), '--editor']
            env = dict(os.environ, HOME=str(home))
            result = subprocess.run(command + [str(path)], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertNotIn('must-remain-private', result.stdout + result.stderr)
            after = path.read_bytes()
            self.assertEqual(yaml.safe_load(after), module.desired_config(original, POLICY))
            backups = list((path.parent / 'state/config-backups').glob('*'))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_bytes(), before)
            self.assertEqual(backups[0].stat().st_mode & 0o777, 0o600)
            result = subprocess.run(command + [str(path)], env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0)
            self.assertEqual(path.read_bytes(), after)
            self.assertEqual(len(list((path.parent / 'state/config-backups').glob('*'))), 1)
            foreign = home / '.hermes/config.yaml'
            foreign.write_bytes(before)
            result = subprocess.run(command + [str(foreign)], env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(foreign.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
