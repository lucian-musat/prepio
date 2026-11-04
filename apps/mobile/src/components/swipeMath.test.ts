import { SWIPE_DISTANCE, SWIPE_TILT, SWIPE_VELOCITY, rubberBand, swipeOffset, swipeTarget, swipeTilt } from './swipeMath';

const W = 400;
const both = { canPrev: true, canNext: true };

describe('swipeTarget', () => {
  it('commits by distance past a quarter of the width: left = next, right = prev', () => {
    expect(SWIPE_DISTANCE).toBe(0.25);
    expect(swipeTarget(-101, 0, W, both)).toBe('next');
    expect(swipeTarget(101, 0, W, both)).toBe('prev');
    expect(swipeTarget(-99, 0, W, both)).toBeNull();
    expect(swipeTarget(99, 0, W, both)).toBeNull();
  });

  it('commits by velocity past 500 px/s even on a short drag', () => {
    expect(SWIPE_VELOCITY).toBe(500);
    expect(swipeTarget(-20, -501, W, both)).toBe('next');
    expect(swipeTarget(20, 501, W, both)).toBe('prev');
    expect(swipeTarget(-20, -499, W, both)).toBeNull();
  });

  it('a fast flick back against the drag follows the flick', () => {
    expect(swipeTarget(-150, 800, W, both)).toBe('prev');
  });

  it('never commits past the ends', () => {
    expect(swipeTarget(300, 0, W, { canPrev: false, canNext: true })).toBeNull();
    expect(swipeTarget(-300, -900, W, { canPrev: true, canNext: false })).toBeNull();
  });

  it('an unknown width only commits by velocity', () => {
    expect(swipeTarget(-300, 0, 0, both)).toBeNull();
    expect(swipeTarget(-30, -600, 0, both)).toBe('next');
  });
});

describe('swipeOffset and rubberBand', () => {
  it('follows the finger where there is a card to go to', () => {
    expect(swipeOffset(-120, W, both)).toBe(-120);
    expect(swipeOffset(80, W, both)).toBe(80);
  });

  it('resists past the ends, always less than the drag and bounded by the width', () => {
    const atStart = swipeOffset(200, W, { canPrev: false, canNext: true });
    expect(atStart).toBeGreaterThan(0);
    expect(atStart).toBeLessThan(200);
    expect(swipeOffset(-200, W, { canPrev: true, canNext: false })).toBeCloseTo(-atStart);
    expect(rubberBand(100000, W)).toBeLessThan(W);
    expect(rubberBand(0, W)).toBe(0);
    // More drag still moves a bit further (monotonic).
    expect(rubberBand(300, W)).toBeGreaterThan(rubberBand(200, W));
  });
});

describe('swipeTilt', () => {
  it('tilts with the drag (same sign as cardInConfig) and caps at 3 degrees', () => {
    expect(SWIPE_TILT).toBeLessThanOrEqual(3);
    expect(swipeTilt(-W / 2, W)).toBeLessThan(0);
    expect(swipeTilt(W / 2, W)).toBeGreaterThan(0);
    expect(swipeTilt(10 * W, W)).toBe(SWIPE_TILT);
    expect(swipeTilt(-10 * W, W)).toBe(-SWIPE_TILT);
    expect(swipeTilt(50, 0)).toBe(0);
  });
});
