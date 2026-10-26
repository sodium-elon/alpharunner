"""Installer regressions: only temporary source/profile trees, never live installs."""
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

INSTALLER = Path(__file__).with_name('install-sportscoach-skills.py')
SOURCE = INSTALLER.parent.parent / 'skills'
NAMES = ('sportscoach-decisions', 'running-coaching', 'alpharunner-garmin-run-import')


class InstallTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source, self.profile = self.root / 'source', self.root / 'profile'
        shutil.copytree(SOURCE, self.source)

    def run_installer(self, mode='--install'):
        return subprocess.run([sys.executable, '-B', str(INSTALLER), mode,
                               '--source', str(self.source), '--profile-skills', str(self.profile)],
                              capture_output=True, text=True)

    def install(self):
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stderr)

    def seed_retired(self, content='retired workflow'):
        # Model the previous release's managed manifest, not an unmanaged file.
        self.install()
        relative = 'running-coaching/references/legacy-workflow.md'
        target = self.profile / relative
        target.write_text(content)
        manifest_path = self.profile / '.sportscoach-install.json'
        manifest = json.loads(manifest_path.read_text())
        manifest[relative] = hashlib.sha256(target.read_bytes()).hexdigest()
        manifest_path.write_text(json.dumps(manifest))
        return target

    def test_current_only_install_and_verify_are_idempotent_preserving_unmanaged_files(self):
        for name in NAMES:
            backup = self.profile / name / 'SKILL.profile-installed.md'
            backup.parent.mkdir(parents=True)
            backup.write_text('inert local backup')
        self.install()
        self.install()
        result = self.run_installer('--verify')
        self.assertEqual(result.returncode, 0, result.stderr)
        for name in NAMES:
            self.assertEqual((self.profile / name / 'SKILL.md').read_bytes(),
                             (self.source / name / 'SKILL.md').read_bytes())
            self.assertFalse((self.profile / name / 'references/legacy-workflow.md').exists())
            self.assertEqual((self.profile / name / 'SKILL.profile-installed.md').read_text(),
                             'inert local backup')

    def test_install_migrates_external_links_into_profile_read_sandbox(self):
        for name in NAMES:
            for original in (self.source / name).rglob('*'):
                if original.is_file():
                    target = self.profile / name / original.relative_to(self.source / name)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.symlink_to(original)
        self.install()
        for target in self.profile.rglob('*'):
            self.assertFalse(target.is_symlink(), str(target))

    def test_install_updates_unmodified_managed_snapshot(self):
        self.install()
        (self.source / NAMES[0] / 'SKILL.md').write_text('canonical v2')
        self.install()
        self.assertEqual((self.profile / NAMES[0] / 'SKILL.md').read_text(), 'canonical v2')

    def test_install_refuses_local_edits_before_any_copy(self):
        self.install()
        entry = self.profile / NAMES[0] / 'SKILL.md'
        before = entry.read_bytes()
        (self.source / NAMES[0] / 'SKILL.md').write_text('canonical v2')
        local = self.profile / NAMES[-1] / 'references/import-evidence.md'
        local.write_text('unique local research')
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Refusing divergent installed file', result.stderr)
        self.assertEqual(local.read_text(), 'unique local research')
        self.assertEqual(entry.read_bytes(), before)

    def test_missing_current_knowledge_fails_before_install(self):
        for relative in ['running-coaching/references/coaching-evidence.md',
                         'alpharunner-garmin-run-import/references/import-evidence.md']:
            with self.subTest(relative=relative):
                original = self.source / relative
                content = original.read_bytes()
                original.unlink()
                result = self.run_installer()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(relative, result.stderr)
                self.assertFalse(self.profile.exists())
                original.write_bytes(content)

    def test_install_deletes_only_unchanged_retired_managed_files(self):
        retired = self.seed_retired()
        unmanaged = retired.with_name('personal-research.md')
        unmanaged.write_text('preserve me')
        self.install()
        self.assertFalse(retired.exists())
        self.assertEqual(unmanaged.read_text(), 'preserve me')
        manifest = json.loads((self.profile / '.sportscoach-install.json').read_text())
        self.assertNotIn('running-coaching/references/legacy-workflow.md', manifest)
        self.assertEqual(self.run_installer('--verify').returncode, 0)

    def test_verify_detects_retired_managed_files_without_deleting(self):
        retired = self.seed_retired()
        result = self.run_installer('--verify')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Retired managed file', result.stderr)
        self.assertTrue(retired.exists())

    def test_divergent_retired_knowledge_blocks_all_deletions_copies_and_manifest_writes(self):
        retired = self.seed_retired()
        retired.write_text('unique retired knowledge')
        other = self.profile / 'running-coaching/references/retired-other.md'
        other.write_text('unchanged obsolete')
        manifest_path = self.profile / '.sportscoach-install.json'
        manifest = json.loads(manifest_path.read_text())
        manifest[str(other.relative_to(self.profile))] = hashlib.sha256(other.read_bytes()).hexdigest()
        manifest_path.write_text(json.dumps(manifest))
        before = manifest_path.read_bytes()
        entry = self.profile / NAMES[0] / 'SKILL.md'
        entry_before = entry.read_bytes()
        (self.source / NAMES[0] / 'SKILL.md').write_text('new canonical entry')
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Refusing divergent retired file', result.stderr)
        self.assertEqual(retired.read_text(), 'unique retired knowledge')
        self.assertTrue(other.exists())
        self.assertEqual(entry.read_bytes(), entry_before)
        self.assertEqual(manifest_path.read_bytes(), before)

    def test_retired_symlink_is_unlinked_without_touching_external_content(self):
        retired = self.seed_retired()
        external = self.root / 'outside.md'
        external.write_bytes(retired.read_bytes())
        retired.unlink()
        retired.symlink_to(external)
        self.install()
        self.assertFalse(retired.is_symlink())
        self.assertEqual(external.read_text(), 'retired workflow')

    def test_manifest_cannot_delete_outside_managed_supporting_files(self):
        self.install()
        outside = self.root / 'outside.md'
        outside.write_text('preserve outside')
        manifest_path = self.profile / '.sportscoach-install.json'
        for relative in ['../outside.md', '/tmp/outside.md',
                         'unmanaged/references/file.md',
                         'running-coaching/SKILL.profile-installed.md',
                         'running-coaching/references/../../outside.md']:
            with self.subTest(relative=relative):
                original = manifest_path.read_bytes()
                manifest = json.loads(original)
                manifest[relative] = hashlib.sha256(outside.read_bytes()).hexdigest()
                manifest_path.write_text(json.dumps(manifest))
                result = self.run_installer()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('Invalid managed path', result.stderr)
                self.assertEqual(outside.read_text(), 'preserve outside')
                manifest_path.write_bytes(original)

    def test_manifest_cannot_traverse_symlink_parent_for_retired_deletion(self):
        self.install()
        external = self.root / 'external'
        external.mkdir()
        protected = external / 'private.md'
        protected.write_text('preserve outside')
        (self.profile / 'running-coaching/references/linked').symlink_to(external, target_is_directory=True)
        manifest_path = self.profile / '.sportscoach-install.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['running-coaching/references/linked/private.md'] = hashlib.sha256(protected.read_bytes()).hexdigest()
        manifest_path.write_text(json.dumps(manifest))
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Unsafe managed parent', result.stderr)
        self.assertEqual(protected.read_text(), 'preserve outside')


if __name__ == '__main__':
    unittest.main()
