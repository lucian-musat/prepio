/**
 * Reasoning models (gpt-5 family, o-series) default to medium effort, which made evaluations take 30–60 s and hit
 * the timeouts. Low effort is enough for checking a few sentences against a teacher's context. Other models reject
 * the option, so they get none.
 */
export function reasoningFor(model: string): { effort: 'low' } | undefined {
  return /^(gpt-5|o\d)/i.test(model) ? { effort: 'low' } : undefined;
}
