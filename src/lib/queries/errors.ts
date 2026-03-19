export function logQueryError(context: string, error: unknown) {
  const detail =
    error != null && typeof error === 'object' && 'message' in error
      ? (error as { message: string }).message
      : String(error);
  console.error(`Query failed: ${context} — ${detail}`, error);
}
