import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

let configuredDbUrl = process.env.DATABASE_URL;

// On Vercel / serverless environments, the root file system is read-only.
// Copy the seeded SQLite database to /tmp so citizen ingestion, What-If simulation,
// and human reviews succeed without throwing EROFS (Read-only file system) errors.
if (process.env.VERCEL) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const tmpDbPath = '/tmp/dev.db';
  if (!fs.existsSync(tmpDbPath)) {
    const candidatePaths = [
      path.resolve(process.cwd(), 'prisma/dev.db'),
      path.resolve(currentDir, '../../prisma/dev.db'),
      path.resolve(currentDir, '../prisma/dev.db'),
      '/var/task/prisma/dev.db',
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          fs.copyFileSync(p, tmpDbPath);
          console.log(`[Vercel Serverless] Seeded database copied from ${p} to ${tmpDbPath}`);
          break;
        } catch (e) {
          console.warn('[Vercel Serverless] Failed to copy db from', p, e);
        }
      }
    }
  }
  if (fs.existsSync(tmpDbPath)) {
    configuredDbUrl = `file:${tmpDbPath}`;
  }
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    datasources: configuredDbUrl ? { db: { url: configuredDbUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}
