/** Romanian count with the „de” rule: „1 cuvânt”, „2 cuvinte”, „19 cuvinte”, „20 de cuvinte”, „120 de cuvinte”, „105 cuvinte”. */
export function plural(n: number, one: string, many: string): string {
  if (n === 1) return `1 ${one}`;
  const de = n >= 20 && (n % 100 === 0 || n % 100 >= 20);
  return `${n} ${de ? 'de ' : ''}${many}`;
}
