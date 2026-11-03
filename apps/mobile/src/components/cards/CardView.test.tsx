import { render, screen } from '@testing-library/react-native';
import { CARD_TYPES, emptyCardContent, type Card } from '@prepio/shared';
import CardView from './CardView';

const make = (content: ReturnType<typeof emptyCardContent>, title: string | null = null): Card => ({ id: 'c1', position: 1, title, ...content });

it('shows the type label and the eyebrow for a timeline card', async () => {
  await render(<CardView card={make(emptyCardContent('timeline', () => 'x'))} eyebrow="Cartonaș 2 din 7" />);
  expect(screen.getByText('Axă cronologică')).toBeTruthy();
  expect(screen.getByText('Cartonaș 2 din 7')).toBeTruthy();
});

it('renders a text card with title and formatted body', async () => {
  await render(<CardView card={make({ type: 'text', text: 'Corp **important**' }, 'Titlu')} eyebrow="Cartonaș 1 din 1" />);
  expect(screen.getByText('Titlu')).toBeTruthy();
  expect(screen.getByText('important')).toBeTruthy();
});

it('renders every type from emptyCardContent without crashing', async () => {
  for (const type of CARD_TYPES) {
    const view = await render(<CardView card={make(emptyCardContent(type, () => 'x'))} eyebrow="Cartonaș 1 din 1" />);
    view.unmount();
  }
});
