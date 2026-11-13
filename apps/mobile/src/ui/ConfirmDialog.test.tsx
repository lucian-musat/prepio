import { render, screen } from '@testing-library/react-native';
import ConfirmDialog from './ConfirmDialog';
import { applyOverrides, resetTexts } from '../texts/store';

afterEach(() => resetTexts());

const dialog = () => <ConfirmDialog visible title="Sigur?" message="Mesaj" confirmLabel="Da" onConfirm={jest.fn()} onCancel={jest.fn()} />;

it('has a default cancel button and a backdrop that closes', async () => {
  await render(dialog());
  expect(screen.getByRole('button', { name: 'Anulează' })).toBeTruthy();
  expect(screen.getByLabelText('Închide')).toBeTruthy();
});

it('takes the default labels from the texts', async () => {
  applyOverrides({ 'common.cancel': '[override]', 'common.close': '[close]' });
  await render(dialog());
  expect(screen.getByRole('button', { name: '[override]' })).toBeTruthy();
  expect(screen.getByLabelText('[close]')).toBeTruthy();
});
