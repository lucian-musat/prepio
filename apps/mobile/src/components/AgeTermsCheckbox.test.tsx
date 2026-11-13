import { render, screen } from '@testing-library/react-native';
import AgeTermsCheckbox from './AgeTermsCheckbox';
import { applyOverrides, resetTexts } from '../texts/store';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

afterEach(resetTexts);

it('shows admin overrides of the consent sentence and the link labels', async () => {
  applyOverrides({ 'auth.consent.label': '[sentence]', 'auth.consent.privacyLink': '[privacy]' });
  await render(<AgeTermsCheckbox checked={false} onChange={jest.fn()} />);
  expect(screen.getByText('[sentence]')).toBeTruthy();
  expect(screen.getByRole('link', { name: '[privacy]' })).toBeTruthy();
});
