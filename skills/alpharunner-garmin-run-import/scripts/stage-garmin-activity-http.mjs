#!/usr/bin/env node
/** Compatibility wrapper: stage one activity through garmin-cli (no MCP). */
import { spawnSync } from 'node:child_process';

const activityId = process.argv[2];
const outputPath = process.argv[3] || '/home/john/projects/alpharunner.workspace/garmin-staged.json';
if (!activityId || !/^\d+$/.test(activityId)) {
  console.error('Usage: node stage-garmin-activity-http.mjs <numericActivityId> [outputPath]');
  process.exit(2);
}
const cli = '/home/john/projects/garmin-cli.workspace/garmin-cli/.venv/bin/garmin-cli';
const result = spawnSync(cli, [
  '--tokenstore', '/home/john/.garmin-cli/tokens',
  'stage', '--activity', activityId, '--out', outputPath,
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
