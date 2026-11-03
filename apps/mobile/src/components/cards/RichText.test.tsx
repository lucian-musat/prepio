import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import RichText from './RichText';

it('renders bold and italic spans', async () => {
  await render(<RichText source="Un **gros** și *oblic* text" />);
  const bold = screen.getByText('gros');
  const italic = screen.getByText('oblic');
  expect(StyleSheet.flatten(bold.props.style).fontFamily).toBe('NunitoSans-Bold');
  expect(StyleSheet.flatten(italic.props.style).fontStyle).toBe('italic');
});

it('renders list items', async () => {
  await render(<RichText source={'- unu\n- doi'} />);
  expect(screen.getByText('unu')).toBeTruthy();
  expect(screen.getByText('doi')).toBeTruthy();
});

it('renders a callout with its label', async () => {
  await render(<RichText source={':::retine\nConținut important\n:::'} />);
  expect(screen.getByText('De reținut')).toBeTruthy();
  expect(screen.getByText('Conținut important')).toBeTruthy();
});

it('renders HTML as literal text', async () => {
  await render(<RichText source="<b>x</b>" />);
  expect(screen.getByText('<b>x</b>')).toBeTruthy();
});

it('headings keep the section typography and spans inherit the parent colour', async () => {
  await render(<RichText source={'### Titlu\n\n:::atentie\nText **gros**\n:::'} />);
  const h = StyleSheet.flatten(screen.getByRole('header').props.style);
  expect(h.fontFamily).toBe('Nunito-Black');
  expect(h.fontSize).toBe(18);
  const span = StyleSheet.flatten(screen.getByText('gros').props.style);
  expect(span.color).toBeUndefined();
  expect(span.fontSize).toBeUndefined();
});
