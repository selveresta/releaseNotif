import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { AppDb } from './client';

export async function runMigrations(db: AppDb) {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  await migrate(db, { migrationsFolder });
}
