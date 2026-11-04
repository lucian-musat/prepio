/**
 * Plain Errors carry our Romanian messages; anything else (PostgREST/network objects, Error subclasses such as
 * PostgrestError) gets `fallback`, so raw English text never reaches the student.
 */
export const ownMessage = (e: unknown, fallback: string): string =>
  e instanceof Error && e.constructor === Error && e.message ? e.message : fallback;
