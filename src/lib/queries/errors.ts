export function logQueryError(context: string, error: unknown) {
  console.error(`Query failed: ${context}`, error);
}
