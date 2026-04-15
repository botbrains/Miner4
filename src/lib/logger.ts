/**
 * Minimal structured JSON logger.
 *
 * Each log entry is a JSON object written to stdout (info/warn) or stderr
 * (error) so that it can be ingested by log-aggregation tooling.
 *
 * Usage:
 *   const log = createLogger('payments/webhook');
 *   log.info('Payment confirmed', { orderId, paymentId });
 *   log.error('Provisioning failed', { orderId, err });
 */

export interface LogMeta {
  [key: string]: unknown;
}

export interface Logger {
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
}

function serialize(
  level: 'info' | 'warn' | 'error',
  context: string,
  message: string,
  meta?: LogMeta,
): string {
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    context,
    message,
    ...meta,
  });
}

export function createLogger(context: string): Logger {
  return {
    info(message, meta) {
      console.log(serialize('info', context, message, meta));
    },
    warn(message, meta) {
      console.warn(serialize('warn', context, message, meta));
    },
    error(message, meta) {
      console.error(serialize('error', context, message, meta));
    },
  };
}
