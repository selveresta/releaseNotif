import type { AppEnv } from '../../config/env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createLogger(env: Pick<AppEnv, 'LOG_LEVEL'>) {
  const threshold = priorities[env.LOG_LEVEL ?? 'info'];

  function write(level: LogLevel, message: string, meta?: unknown) {
    if (priorities[level] < threshold) {
      return;
    }

    const payload = meta === undefined ? message : `${message} ${JSON.stringify(meta)}`;
    const writer = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    writer(`[${level}] ${payload}`);
  }

  return {
    debug: (message: string, meta?: unknown) => write('debug', message, meta),
    info: (message: string, meta?: unknown) => write('info', message, meta),
    warn: (message: string, meta?: unknown) => write('warn', message, meta),
    error: (message: string, meta?: unknown) => write('error', message, meta),
  };
}
