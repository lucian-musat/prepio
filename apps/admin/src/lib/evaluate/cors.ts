/** Origins allowed to call the API, from the comma-separated STUDENT_WEB_ORIGINS env var. */
export function allowedOrigins(env: string | undefined = process.env.STUDENT_WEB_ORIGINS): string[] {
  return (env ?? 'http://localhost:8081')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' };
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    headers['Access-Control-Max-Age'] = '600';
  }
  return headers;
}
