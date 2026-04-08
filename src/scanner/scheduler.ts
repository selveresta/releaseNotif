import cron from 'node-cron';
import type { ScannerService } from '../services/scanner.service';
import type { AppMetrics } from '../infrastructure/metrics/metrics';

export function createScannerScheduler(scanner: ScannerService, metrics: AppMetrics) {
  let running = false;

  async function runOnce() {
    if (running) {
      return;
    }

    running = true;
    try {
      await scanner.runOnce();
      metrics.recordScannerRun('success');
    } catch (error) {
      metrics.recordScannerRun('failure');
      throw error;
    } finally {
      running = false;
    }
  }

  return {
    runOnce,
    start(cronExpression: string) {
      return cron.schedule(cronExpression, async () => {
        try {
          await runOnce();
        } catch {
          // The per-repository scanner already logs and absorbs expected errors.
        }
      });
    },
  };
}

export function startScannerScheduler(scanner: ScannerService, cronExpression: string, metrics: AppMetrics) {
  const scheduler = createScannerScheduler(scanner, metrics);
  const task = scheduler.start(cronExpression);

  return {
    stop: () => task.stop(),
    runOnce: scheduler.runOnce,
  };
}
