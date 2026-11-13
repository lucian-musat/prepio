/** Matches the `#boot-loader` opacity transition in public/index.html, plus a margin. */
const FADE_MS = 200;

/**
 * Fades out the `#boot-loader` overlay of public/index.html (a sibling of #root) and removes it. The removal also
 * runs on a timer, because `transitionend` never fires when the transition is off (reduced motion, hidden tab).
 */
export function hideBootLoader(): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('boot-loader');
  if (!el || el.classList.contains('boot-loader--done')) return;
  el.classList.add('boot-loader--done');
  const remove = () => el.remove();
  el.addEventListener('transitionend', remove, { once: true });
  setTimeout(remove, FADE_MS + 100);
}
