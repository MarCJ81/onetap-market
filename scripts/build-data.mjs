#!/usr/bin/env node
/**
 * Rebuilds data/apps.bundle.js from data/apps.json.
 * The page loads the bundle so it still works opened from disk (file://),
 * where fetch() of a local JSON file is blocked. test.js fails if the two drift.
 *
 *   node scripts/build-data.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const data = JSON.parse(await readFile(join(ROOT, 'data', 'apps.json'), 'utf8'));
const src =
  '/* Generated from data/apps.json by scripts/build-data.mjs — do not edit by hand. */\n' +
  'globalThis.__ONETAP_MARKET__ = ' +
  JSON.stringify(data, null, 2) +
  ';\n';
await writeFile(join(ROOT, 'data', 'apps.bundle.js'), src, 'utf8');
console.log(`data/apps.bundle.js rebuilt · ${data.apps.length} apps`);
