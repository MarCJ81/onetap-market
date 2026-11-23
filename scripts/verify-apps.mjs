#!/usr/bin/env node
/**
 * OneTap Market · daily liveness check
 *
 *   node scripts/verify-apps.mjs            # check every URL, write results back
 *   node scripts/verify-apps.mjs --dry      # check and print, do not touch files
 *   node scripts/verify-apps.mjs --only price-radar-kr,ics-viewer-online
 *
 * For each app in data/apps.json it sends a HEAD request (GET when a host
 * refuses HEAD), follows redirects, and records the final HTTP status plus an
 * ISO timestamp. The file is written back and data/apps.bundle.js is rebuilt so
 * the page keeps working when opened straight from disk.
 *
 * Exit code 0 = every URL answered 200, 1 = at least one did not.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DATA = join(ROOT, 'data', 'apps.json');
const BUNDLE = join(ROOT, 'data', 'apps.bundle.js');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const onlyArg = args.find((a) => a.startsWith('--only'));
const only = onlyArg
  ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1] || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

const TIMEOUT_MS = 20000;
const UA =
  'Mozilla/5.0 (compatible; OneTapMarketVerify/1.0; +https://github.com/MarCJ81/onetap-market)';

async function probe(url) {
  const started = Date.now();
  const attempt = async (method) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: ac.signal,
        headers: { 'user-agent': UA, accept: 'text/html,*/*' },
      });
      // Drain a little so the socket closes cleanly, then let it go.
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
      return { status: res.status, finalUrl: res.url || url };
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let out = await attempt('HEAD');
    if (out.status === 403 || out.status === 405 || out.status === 501 || out.status === 0) {
      out = await attempt('GET');
    }
    return { ...out, ms: Date.now() - started, error: null };
  } catch (err) {
    return {
      status: 0,
      finalUrl: url,
      ms: Date.now() - started,
      error: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err),
    };
  }
}

function bundleSource(data) {
  return (
    '/* Generated from data/apps.json by scripts/build-data.mjs — do not edit by hand. */\n' +
    'globalThis.__ONETAP_MARKET__ = ' +
    JSON.stringify(data, null, 2) +
    ';\n'
  );
}

async function main() {
  const raw = await readFile(DATA, 'utf8');
  const data = JSON.parse(raw);
  const targets = only
    ? data.apps.filter((a) => only.includes(a.id) || only.includes(a.slug))
    : data.apps;

  if (!targets.length) {
    console.error('no app matched --only');
    process.exit(2);
  }

  console.log(`OneTap Market · checking ${targets.length} URL(s)\n`);
  const now = new Date();
  const startedAt = Date.now();
  let okCount = 0;
  const lines = [];

  // Small concurrency so every request finishes quickly but politely.
  const queue = [...targets];
  const results = new Map();
  const workers = Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const app = queue.shift();
      const r = await probe(app.url);
      results.set(app.id, r);
    }
  });
  await Promise.all(workers);

  for (const app of targets) {
    const r = results.get(app.id);
    const good = r.status === 200;
    if (good) okCount += 1;
    app.httpStatus = r.status;
    app.lastChecked = now.toISOString();
    if (r.error) app.lastError = r.error;
    else delete app.lastError;
    const mark = good ? 'OK  ' : 'FAIL';
    const label = `${app.id}`.padEnd(34);
    lines.push(
      `  ${mark} ${String(r.status).padStart(3)}  ${String(r.ms).padStart(4)}ms  ${label} ${app.url}` +
        (r.error ? `  (${r.error})` : '')
    );
  }
  lines.forEach((l) => console.log(l));

  const allOk = targets.every((a) => a.httpStatus === 200);
  if (!only) {
    data.meta.lastFullCheck = now.toISOString();
    data.meta.lastFullCheckOk = okCount;
    data.meta.lastFullCheckTotal = targets.length;
    data.meta.lastCheckDurationMs = Date.now() - startedAt;
    data.meta.checkedBy = 'scripts/verify-apps.mjs';
  }

  console.log(
    `\n${okCount}/${targets.length} answered 200` +
      ` · ${((Date.now() - startedAt) / 1000).toFixed(1)}s` +
      (DRY ? ' · dry run, files untouched' : '')
  );

  if (!DRY) {
    await writeFile(DATA, JSON.stringify(data, null, 2) + '\n', 'utf8');
    await writeFile(BUNDLE, bundleSource(data), 'utf8');
    console.log('wrote data/apps.json + data/apps.bundle.js');
  }

  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
