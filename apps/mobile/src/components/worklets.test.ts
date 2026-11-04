import * as motion from '../ui/motion';
import * as swipeMath from './swipeMath';
import * as zoomMath from './cards/zoomMath';

// Helpers called from gesture callbacks run on the UI thread: they must be worklets, or native throws when the
// callback calls them. The worklets Babel plugin (active under jest-expo) tags a worklet with __workletHash.
const isWorklet = (fn: unknown) => typeof (fn as { __workletHash?: number }).__workletHash === 'number';

it.each([
  ['timing', motion.timing],
  ['rubberBand', swipeMath.rubberBand],
  ['swipeOffset', swipeMath.swipeOffset],
  ['swipeTarget', swipeMath.swipeTarget],
  ['swipeTilt', swipeMath.swipeTilt],
  ['clampTranslation', zoomMath.clampTranslation],
])('%s is a worklet', (_, fn) => {
  expect(isWorklet(fn)).toBe(true);
});
