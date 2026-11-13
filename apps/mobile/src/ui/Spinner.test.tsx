import { render, screen } from '@testing-library/react-native';
import Spinner from './Spinner';
import { applyOverrides, resetTexts } from '../texts/store';

afterEach(() => resetTexts());

it('is named „Se încarcă” by default', async () => {
  await render(<Spinner />);
  expect(screen.getByLabelText('Se încarcă')).toBeTruthy();
});

it('takes its default name from the texts', async () => {
  applyOverrides({ 'common.loading': '[override]' });
  await render(<Spinner />);
  expect(screen.getByLabelText('[override]')).toBeTruthy();
});
