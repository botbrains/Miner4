#!/usr/bin/env tsx
/**
 * One-shot script to register all configured solo mining pools on MRR.
 *
 * For each entry in src/config/pools.ts:
 *   - Calls GET /pool to check if a pool with that name already exists
 *   - If not found, calls POST /pool to register it
 *   - Logs: ✓ registered / ~ skipped (already exists) / ✗ error for each
 *
 * Usage:
 *   npx tsx scripts/register-pools.ts
 *
 * Requires MRR_API_KEY and MRR_API_SECRET in the environment (or .env.local).
 */

import { config as dotenv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env.local so the script works without the Next.js runtime
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv({ path: path.resolve(__dirname, '..', '.env.local') });

// Dynamic import after env is loaded
const { POOLS } = await import('../src/config/pools.ts');
const { mrrRequest } = await import('../src/lib/mrr.ts');

interface MrrPool {
  id: number | string;
  name: string;
}

interface ListPoolsResponse {
  success: boolean;
  data: MrrPool[] | { pools: MrrPool[] };
}

interface CreatePoolResponse {
  success: boolean;
  data: { id: number | string };
}

async function main() {
  console.log('Fetching existing pools from MRR…');

  const listRes = await mrrRequest<ListPoolsResponse>('GET', '/pool');
  const rawPools = listRes.data;
  const existingPools: MrrPool[] = Array.isArray(rawPools)
    ? rawPools
    : (rawPools as { pools: MrrPool[] }).pools ?? [];

  const existingNames = new Set(existingPools.map(p => p.name));
  console.log(`Found ${existingNames.size} existing pool(s).\n`);

  let registered = 0;
  let skipped = 0;
  let errors = 0;

  for (const pool of POOLS) {
    if (existingNames.has(pool.name)) {
      console.log(`  ~ skipped  : ${pool.name}`);
      skipped++;
      continue;
    }

    try {
      const res = await mrrRequest<CreatePoolResponse>('POST', '/pool', {
        name: pool.name,
        host: pool.host,
        port: pool.port,
        pass: pool.password,
      });
      console.log(`  ✓ registered: ${pool.name} → id=${res.data.id}`);
      registered++;
    } catch (err) {
      console.error(`  ✗ error    : ${pool.name} – ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }
  }

  console.log(`\nDone. Registered: ${registered}, Skipped: ${skipped}, Errors: ${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
