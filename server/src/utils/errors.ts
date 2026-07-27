/**
 * Returns a safe error message for clients.
 * In production, internal details are stripped.
 */
export function safeErrorMessage(err: any): string {
  if (process.env.NODE_ENV === 'production') {
    return "Internal server error";
  }
  return err?.message || "Internal server error";
}
