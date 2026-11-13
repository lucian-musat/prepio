import { render, screen } from '@testing-library/react-native';
import { CARD_TYPES, emptyCardContent, type Card } from '@prepio/shared';
import CardView from './CardView';
import { applyOverrides, resetTexts } from '../../texts/store';

const make = (content: ReturnType<typeof emptyCardContent>, title: string | null = null): Card => ({ id: 'c1', position: 1, title, ...content });

it('students see the position, not the card type', async () => {
  await render(<CardView card={make(emptyCardContent('timeline', () => 'x'))} eyebrow="Card 2 din 7" />);
  expect(screen.queryByText('Axă cronologică')).toBeNull();
  expect(screen.getByText('Card 2 din 7')).toBeTruthy();
});

it('the admin preview keeps the type label', async () => {
  await render(<CardView card={make(emptyCardContent('timeline', () => 'x'))} eyebrow="Card 2 din 7" showType />);
  expect(screen.getByText('Axă cronologică')).toBeTruthy();
});

it('renders a text card with title and formatted body', async () => {
  await render(<CardView card={make({ type: 'text', text: 'Corp **important**' }, 'Titlu')} eyebrow="Card 1 din 1" />);
  expect(screen.getByText('Titlu')).toBeTruthy();
  expect(screen.getByText('important')).toBeTruthy();
});

it('the admin preview type chip takes its text from the catalog', async () => {
  applyOverrides({ 'cards.type.timeline': '[override]' });
  try {
    await render(<CardView card={make(emptyCardContent('timeline', () => 'x'))} eyebrow="Card 2 din 7" showType />);
    expect(screen.getByText('[override]')).toBeTruthy();
  } finally {
    resetTexts();
  }
});

it('renders every type from emptyCardContent without crashing', async () => {
  for (const type of CARD_TYPES) {
    const view = await render(<CardView card={make(emptyCardContent(type, () => 'x'))} eyebrow="Card 1 din 1" />);
    view.unmount();
  }
});
