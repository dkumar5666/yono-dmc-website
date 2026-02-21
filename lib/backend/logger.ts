export function logInfo(message: string, meta?: Record<string, unknown>) {
  console.info(`[INFO] ${message}`, meta ?? {});
}

export function logWarn(message: string, meta?: Record<string, unknown>) {
  console.warn(`[WARN] ${message}`, meta ?? {});
}

export function logError(message: string, meta?: Record<string, unknown>) {
  console.error(`[ERROR] ${message}`, meta ?? {});
}

