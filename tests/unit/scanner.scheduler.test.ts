import { describe, expect, it, vi } from 'vitest';
import { createScannerScheduler } from '../../src/scanner/scheduler';

describe('scanner scheduler lock', () => {
  it('prevents overlapping runs', async () => {
    let resolveRun: () => void = () => undefined;
    const scanner = {
      runOnce: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveRun = resolve;
          }),
      ),
    } as any;
    const metrics = {
      recordScannerRun: vi.fn(),
    } as any;

    const scheduler = createScannerScheduler(scanner, metrics);
    const first = scheduler.runOnce();
    const second = scheduler.runOnce();
    expect(scanner.runOnce).toHaveBeenCalledTimes(1);

    resolveRun();
    await first;
    await second;

    expect(metrics.recordScannerRun).toHaveBeenCalledWith('success');
  });
});
