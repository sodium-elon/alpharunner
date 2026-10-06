"""Regression for the versioned installer; all writes stay in a temporary tree."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

INSTALLER = Path(__file__).with_name('install-sportscoach-skills.py')
NAMES = ('sportscoach-decisions', 'running-coaching', 'alpharunner-garmin-run-import')


class InstallTest(unittest.TestCase):
    def test_restores_entrypoints_without_losing_legacy_references_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, profile = root / 'canonical', root / 'profile'
            for name in NAMES:
                (source / name / 'references').mkdir(parents=True)
                (profile / name / 'references').mkdir(parents=True)
                (source / name / 'SKILL.md').write_text(f'---\nname: {name}\n---\ncanonical')
                (source / name / 'references/legacy-workflow.md').write_text('preserved knowledge')
                (profile / name / 'references/legacy-workflow.md').write_text('preserved knowledge')
                (profile / name / 'SKILL.profile-installed.md').write_text('old inert backup')
            for mode in ('--install', '--install', '--verify'):
                result = subprocess.run([sys.executable, str(INSTALLER), mode,
                                         '--source', str(source), '--profile-skills', str(profile)],
                                        capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
            for name in NAMES:
                self.assertEqual((profile / name / 'SKILL.md').read_bytes(), (source / name / 'SKILL.md').read_bytes())
                self.assertEqual((profile / name / 'references/legacy-workflow.md').read_text(), 'preserved knowledge')
                self.assertEqual((profile / name / 'SKILL.profile-installed.md').read_text(), 'old inert backup')
                self.assertEqual(len(list((profile / name).glob('SKILL.md'))), 1)

    def test_install_migrates_external_links_into_the_profile_read_sandbox(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, profile = Path(tmp) / 'source', Path(tmp) / 'profile'
            for name in NAMES:
                (source / name / 'references').mkdir(parents=True)
                (source / name / 'SKILL.md').write_text('canonical')
                original = source / name / 'references/legacy-workflow.md'
                original.write_text('canonical knowledge')
                target = profile / name / 'references/legacy-workflow.md'
                target.parent.mkdir(parents=True)
                target.symlink_to(original)
            result = subprocess.run([sys.executable, str(INSTALLER), '--install',
                                     '--source', str(source), '--profile-skills', str(profile)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            for name in NAMES:
                target = profile / name / 'references/legacy-workflow.md'
                self.assertTrue(target.resolve().is_relative_to((profile / name).resolve()),
                                'Hermes rejects references resolving outside their skill root')
                self.assertEqual(target.read_text(), 'canonical knowledge')

    def test_install_updates_unmodified_managed_snapshots_after_canonical_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, profile = Path(tmp) / 'source', Path(tmp) / 'profile'
            for name in NAMES:
                (source / name / 'references').mkdir(parents=True)
                (source / name / 'SKILL.md').write_text('canonical v1')
                (source / name / 'references/legacy-workflow.md').write_text('canonical knowledge')
            command = [sys.executable, str(INSTALLER), '--install',
                       '--source', str(source), '--profile-skills', str(profile)]
            first = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            (source / NAMES[0] / 'SKILL.md').write_text('canonical v2')
            second = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertEqual((profile / NAMES[0] / 'SKILL.md').read_text(), 'canonical v2')

    def test_install_preserves_locally_edited_managed_snapshots_without_partial_updates(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, profile = Path(tmp) / 'source', Path(tmp) / 'profile'
            for name in NAMES:
                (source / name / 'references').mkdir(parents=True)
                (source / name / 'SKILL.md').write_text('canonical v1')
                (source / name / 'references/legacy-workflow.md').write_text('canonical knowledge')
            command = [sys.executable, str(INSTALLER), '--install',
                       '--source', str(source), '--profile-skills', str(profile)]
            first = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            (source / NAMES[0] / 'SKILL.md').write_text('canonical v2')
            target = profile / NAMES[-1] / 'references/legacy-workflow.md'
            target.write_text('unique local research')
            second = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(second.returncode, 0)
            self.assertIn('Refusing divergent installed file', second.stderr)
            self.assertEqual(target.read_text(), 'unique local research')
            self.assertEqual((profile / NAMES[0] / 'SKILL.md').read_text(), 'canonical v1')

    def test_divergent_installed_knowledge_is_preserved_without_partial_install(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, profile = Path(tmp) / 'source', Path(tmp) / 'profile'
            for name in NAMES:
                (source / name / 'references').mkdir(parents=True)
                (source / name / 'SKILL.md').write_text('canonical')
                (source / name / 'references/legacy-workflow.md').write_text('canonical knowledge')
            target = profile / NAMES[-1] / 'references/legacy-workflow.md'
            target.parent.mkdir(parents=True)
            target.write_text('unique installed knowledge')
            result = subprocess.run([sys.executable, str(INSTALLER), '--install',
                                     '--source', str(source), '--profile-skills', str(profile)],
                                    capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Refusing divergent installed file', result.stderr)
            self.assertEqual(target.read_text(), 'unique installed knowledge')
            self.assertFalse((profile / NAMES[0] / 'SKILL.md').exists())

    def test_verify_rejects_missing_legacy_knowledge(self):
        with tempfile.TemporaryDirectory() as tmp:
            source, profile = Path(tmp) / 'source', Path(tmp) / 'profile'
            for name in NAMES:
                (source / name).mkdir(parents=True)
                (source / name / 'SKILL.md').write_text('canonical')
            result = subprocess.run([sys.executable, str(INSTALLER), '--install',
                                     '--source', str(source), '--profile-skills', str(profile)],
                                    capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('legacy-workflow.md', result.stderr)
            self.assertFalse(profile.exists())


if __name__ == '__main__':
    unittest.main()
