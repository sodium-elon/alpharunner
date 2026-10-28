"""Static protection contract; actual namespace behavior is verified separately on-host."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
NAMES = ('sportscoach-decisions', 'running-coaching', 'alpharunner-garmin-run-import')


class ProtectionTest(unittest.TestCase):
    def test_native_protection_covers_managed_skills_manifest_and_canonical_knowledge_only(self):
        unit = (ROOT / 'deploy/sportscoach-skill-protection.conf').read_text()
        self.assertIn('[Service]', unit)
        self.assertIn('PrivateUsers=yes', unit)
        self.assertIn('ExecStartPre=/usr/bin/python3 -B %h/projects/alpharunner.workspace/alpharunner/scripts/install-sportscoach-skills.py --verify', unit)
        readonly = next(line.split('=', 1)[1].split() for line in unit.splitlines()
                        if line.startswith('ReadOnlyPaths='))
        expected = {f'%h/.hermes/profiles/sportscoach/skills/{name}' for name in NAMES}
        expected |= {'%h/.hermes/profiles/sportscoach/skills/.sportscoach-install.json',
                     '%h/projects/alpharunner.workspace/alpharunner/skills'}
        self.assertEqual(set(readonly), expected)
        self.assertNotIn('ProtectSystem=', unit)
        self.assertNotIn('ReadWritePaths=', unit)

    def test_ci_executes_all_sportscoach_python_regressions(self):
        workflow = (ROOT / '.github/workflows/quality.yml').read_text()
        commands = [line.split('run:', 1)[1].strip() for line in workflow.splitlines()
                    if line.strip().removeprefix('- ').startswith('run:')]
        self.assertTrue(any('python3 -B -m unittest discover -s scripts' in cmd
                            and 'test_*sportscoach*.py' in cmd for cmd in commands))


if __name__ == '__main__':
    unittest.main()
