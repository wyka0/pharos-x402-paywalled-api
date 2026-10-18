export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

function emit(
  stream: NodeJS.WriteStream,
  level: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(meta ?? {}),
  };
  stream.write(`${JSON.stringify(entry)}\n`);
}

/**
 * Minimal structured logger. Callers must never pass private keys, signatures,
 * authorization headers, or raw environment objects as metadata.
 */
export const consoleLogger: Logger = {
  info: (message, meta) => emit(process.stdout, "info", message, meta),
  warn: (message, meta) => emit(process.stderr, "warn", message, meta),
  error: (message, meta) => emit(process.stderr, "error", message, meta),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
