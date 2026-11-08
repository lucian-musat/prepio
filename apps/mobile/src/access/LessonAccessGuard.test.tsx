import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { router } from 'expo-router';
import LessonAccessGuard from './LessonAccessGuard';

let mockId = 'L2';
jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, useLocalSearchParams: () => ({ id: mockId }) }));
jest.mock('./AccessProvider');
const { mockResetAccess } = jest.requireMock<typeof import('./__mocks__/AccessProvider')>('./AccessProvider');

beforeEach(() => {
  jest.clearAllMocks();
  mockId = 'L2';
  mockResetAccess({ freeLessonId: 'L1' });
});

const mount = () =>
  render(
    <LessonAccessGuard>
      <Text>lesson body</Text>
    </LessonAccessGuard>,
  );

it('a locked lesson replaces the route with Home and its paywall', async () => {
  await mount();
  expect(router.replace).toHaveBeenCalledWith('/?paywall=L2');
  expect(screen.queryByText('lesson body')).toBeNull();
});

it('an openable lesson renders', async () => {
  mockId = 'L1';
  await mount();
  expect(screen.getByText('lesson body')).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
});

it('waits for the first access read before deciding', async () => {
  mockResetAccess({ freeLessonId: 'L1', ready: false });
  await mount();
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.queryByText('lesson body')).toBeNull();
  await act(async () => mockResetAccess({ freeLessonId: 'L1', accessUntil: new Date(Date.now() + 9e8).toISOString() }));
  expect(screen.getByText('lesson body')).toBeTruthy();
});

it('access ending while inside does not throw the student out (the answer stays; the API answers 403)', async () => {
  mockResetAccess({ freeLessonId: 'L1', accessUntil: new Date(Date.now() + 9e8).toISOString() });
  await mount();
  await act(async () => mockResetAccess({ freeLessonId: 'L1' }));
  expect(screen.getByText('lesson body')).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
});
