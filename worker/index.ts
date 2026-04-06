import { prisma } from '../lib/prisma';
import { processNextWorkerJob, recoverStaleRunningJobs } from '../lib/worker';

const DEFAULT_IDLE_MS = 5000;
const idleMs = (() => {
  const raw = Number(process.env.WORKER_IDLE_MS ?? DEFAULT_IDLE_MS);
  return Number.isFinite(raw) && raw >= 500 ? raw : DEFAULT_IDLE_MS;
})();

let stopping = false;

function registerShutdownSignal(signal: NodeJS.Signals) {
  process.on(signal, () => {
    stopping = true;
  });
}

registerShutdownSignal('SIGINT');
registerShutdownSignal('SIGTERM');

async function main() {
  const once = process.argv.includes('--once');
  await recoverStaleRunningJobs();

  if (once) {
    await processNextWorkerJob();
    await prisma.$disconnect();
    return;
  }

  while (!stopping) {
    const worked = await processNextWorkerJob();
    if (!worked) {
      await new Promise((resolve) => setTimeout(resolve, idleMs));
    }
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
