import { typeScale } from '@prepio/shared';
import { type } from '../ui/typography';
import { fontFiles } from './fonts';

it('every typography role uses a loaded, CSS-safe family', () => {
  for (const role of Object.keys(typeScale) as (keyof typeof typeScale)[]) {
    const { fontFamily } = type(role);
    expect(Object.keys(fontFiles)).toContain(fontFamily);
    expect(fontFamily).toMatch(/^[A-Za-z_][A-Za-z0-9_-]*$/);
  }
});

it('headings use Nunito and text uses Nunito Sans', () => {
  expect(type('title').fontFamily).toBe('Nunito-Black');
  expect(type('body').fontFamily).toBe('NunitoSans');
});
