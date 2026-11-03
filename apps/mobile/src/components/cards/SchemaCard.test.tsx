import { fireEvent, render, screen } from '@testing-library/react-native';
import type { CardContent } from '@prepio/shared';
import SchemaCard from './SchemaCard';

type Schema = Extract<CardContent, { type: 'schema' }>;
const box = (id: string, text: string, detail: string | null = null) => ({ id, text, detail });
const schema = (over: Partial<Schema> = {}): Schema => ({
  type: 'schema',
  causesLabel: 'Cauze',
  consequencesLabel: 'Urmări',
  causes: [box('cause-0', 'Destrămarea imperiilor'), box('cause-1', 'Autodeterminarea', 'Principiul lui Wilson')],
  central: box('central', 'Marea Unire'),
  consequences: [box('consequence-0', 'România Mare')],
  ...over,
});

it('renders zone labels, the central box and every box', async () => {
  await render(<SchemaCard content={schema()} />);
  for (const t of ['Cauze', 'Urmări', 'Marea Unire', 'Destrămarea imperiilor', 'Autodeterminarea', 'România Mare']) {
    expect(screen.getByText(t)).toBeTruthy();
  }
});

it('pressing a box with detail reveals it and sets expanded', async () => {
  await render(<SchemaCard content={schema()} />);
  expect(screen.queryByText('Principiul lui Wilson')).toBeNull();
  const toggle = screen.getByRole('button');
  expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
  await fireEvent.press(toggle);
  expect(screen.getByText('Principiul lui Wilson')).toBeTruthy();
  expect(screen.getByRole('button').props.accessibilityState).toMatchObject({ expanded: true });
  await fireEvent.press(screen.getByRole('button'));
  expect(screen.queryByText('Principiul lui Wilson')).toBeNull();
});

it('renders empty zones without crashing', async () => {
  await render(<SchemaCard content={schema({ causes: [], consequences: [] })} />);
  expect(screen.getByText('Marea Unire')).toBeTruthy();
});
