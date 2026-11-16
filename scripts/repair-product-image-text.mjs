// Scoped, reversible image-only repair. Never overwrite existing ImageAsset binaries.
import 'dotenv/config';
import pg from 'pg';
import sharp from 'sharp';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('data/repairs/product-image-text-2026-11-14');
const mode = process.argv[2];
if (!['plan', 'apply', 'verify'].includes(mode)) throw Error('Use plan, apply or verify');
const url = new URL(process.env.DATABASE_URL);
if (url.pathname !== '/aurel_ai' || !['localhost', '127.0.0.1'].includes(url.hostname)) throw Error('Unexpected database target');
const hash = data => createHash('sha256').update(data).digest('hex');
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  if (mode === 'plan') {
    try { await fs.access(path.join(root, 'manifest.json')); throw Error('Manifest already exists; preserve it for rollback'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const inventory = JSON.parse(await fs.readFile('.local/image-text-audit/inventory.json', 'utf8'));
    const jobs = JSON.parse(await fs.readFile('.local/image-text-audit/jobs.json', 'utf8'));
    const entries = [];
    await fs.mkdir(root, { recursive: true });
    for (const job of jobs) {
      const input = await fs.readFile(path.join(root, `${job.id}-clean.png`));
      const original = await sharp(`.local/image-text-audit/${job.id}.webp`).metadata();
      const data = await sharp(input).resize(original.width, original.height, { fit: 'fill' }).webp({ quality: 94 }).toBuffer();
      const assetId = randomUUID();
      await fs.writeFile(path.join(root, `${job.id}-clean.webp`), data);
      for (const id of job.rows) {
        const row = inventory.find(r => r.id === id);
        const { name, slug, ...before } = row;
        await fs.copyFile(`.local/image-text-audit/${id}.webp`, path.join(root, `${id}-original.webp`));
        entries.push({ id, name, slug, before, assetId, storageKey: `/images/uploads/${assetId}.webp`, file: `${job.id}-clean.webp`, width: original.width, height: original.height, sha256: hash(data) });
      }
    }
    await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({ date: '2026-11-14', tool: 'built-in image_gen', entries }, null, 2));
    console.log(JSON.stringify({ planned: entries.length, generatedAssets: jobs.length }));
  } else {
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
    if (mode === 'apply') {
      const applied = [], conflicts = [];
      for (const entry of manifest.entries) {
        const data = await fs.readFile(path.join(root, entry.file));
        if (hash(data) !== entry.sha256) throw Error(`File checksum mismatch ${entry.id}`);
        await client.query('BEGIN');
        try {
          const { rows } = await client.query('SELECT to_jsonb(i) AS row FROM "ProductImage" i WHERE id=$1 FOR UPDATE', [entry.id]);
          const current = rows[0]?.row;
          if (current?.storageKey === entry.storageKey) { await client.query('ROLLBACK'); continue; }
          if (!current || Object.keys(entry.before).some(key => JSON.stringify(current[key]) !== JSON.stringify(entry.before[key]))) {
            conflicts.push(entry.id); await client.query('ROLLBACK'); continue;
          }
          await client.query('INSERT INTO "ImageAsset" (id,data,"mimeType",width,height,"byteSize") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING', [entry.assetId, data, 'image/webp', entry.width, entry.height, data.length]);
          await client.query('UPDATE "ProductImage" SET "storageKey"=$1 WHERE id=$2 AND "storageKey"=$3', [entry.storageKey, entry.id, entry.before.storageKey]);
          await client.query('COMMIT'); applied.push(entry.id);
        } catch (error) { await client.query('ROLLBACK'); throw error; }
      }
      const result = { at: new Date().toISOString(), applied, conflicts };
      await fs.writeFile(path.join(root, `apply-${Date.now()}.json`), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result));
    } else {
      const failures = [];
      for (const entry of manifest.entries) {
        const { rows } = await client.query('SELECT i.*,a.data,a.width,a.height,a."byteSize",a."mimeType" FROM "ProductImage" i LEFT JOIN "ImageAsset" a ON i."storageKey"=\'/images/uploads/\'||a.id||\'.webp\' WHERE i.id=$1', [entry.id]);
        const row = rows[0];
        if (row?.storageKey !== entry.storageKey || !row.data || hash(row.data) !== entry.sha256 || row.byteSize !== row.data.length || row.mimeType !== 'image/webp') { failures.push(entry.id); continue; }
        const metadata = await sharp(row.data).metadata();
        if (metadata.width !== entry.width || metadata.height !== entry.height || Object.keys(entry.before).filter(k => k !== 'storageKey').some(k => JSON.stringify(row[k]) !== JSON.stringify(entry.before[k]))) failures.push(entry.id);
      }
      console.log(JSON.stringify({ verified: manifest.entries.length - failures.length, failures }));
      if (failures.length) process.exitCode = 1;
    }
  }
} finally { await client.end(); }
