import { render, screen } from '@testing-library/react-native';
import CostTag from './CostTag';

it('shows the digital teacher tag with the cost', async () => {
  await render(<CostTag cost={2} />);
  expect(screen.getByLabelText('Profesorul digital, costă 2 credite')).toBeTruthy();
  expect(screen.getByText('✦ Profesorul digital ·')).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy();
  expect(screen.queryByText('/ cerință')).toBeNull();
});

it('adds „/ cerință” per requirement', async () => {
  await render(<CostTag cost={2} perRequirement />);
  expect(screen.getByText('/ cerință')).toBeTruthy();
  expect(screen.getByLabelText('Profesorul digital, costă 2 credite pe cerință')).toBeTruthy();
});
