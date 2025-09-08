import { db } from '.';
import fs from 'fs';
import path from 'path';

// Simple migration runner. Each migration must export up(db) and optionally down(db)
async function ensureMigrationsTable() {
  const exists = await db
    .selectFrom('migrations')
    .selectAll()
    .execute()
    .catch(() => null);
  if (!exists) {
    // Table created by first migration; skip.
  }
}

async function getExecuted(): Promise<Set<string>> {
  const rows = await db.selectFrom('migrations').select('name').execute().catch(()=>[]);
  return new Set(rows.map(r => r.name));
}

async function record(name: string) {
  await db.insertInto('migrations').values({ name, run_at: new Date() }).execute();
}

export async function migrate() {
  const migrationsDir = path.resolve(process.cwd(), 'src/data/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => /\.ts$/.test(f)).sort();
  await ensureMigrationsTable();
  const executed = await getExecuted();
  for (const file of files) {
    if (executed.has(file)) continue;
    const mod = await import(path.resolve(migrationsDir, file));
    if (!mod.up) throw new Error(`Migration ${file} missing up()`);
    console.log(`Running migration ${file}`);
    await mod.up(db);
    await record(file);
  }
  console.log('Migrations complete');
  await db.destroy();
}

// run().catch(async (err) => {
//   console.error(err);
//   await db.destroy();
//   process.exit(1);
// });
