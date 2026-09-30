import { runSeed } from '../src/server/services/seed.service.js';
import { prisma } from '../src/server/db.js';

if (process.argv[1]?.endsWith('seed.ts')) {
  runSeed()
    .catch((e) => {
      console.error('❌ Error during seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { runSeed };
