import { act, renderHook } from '@testing-library/react-native';
import { AccessApiError, purchaseAccess } from '../lib/access';
import { useAccessPurchase, OFFER_CHANGED } from './useAccessPurchase';

jest.mock('../lib/access', () => ({ ...jest.requireActual('../lib/access'), purchaseAccess: jest.fn() }));
jest.mock('../credits/CreditsProvider');
jest.mock('./AccessProvider');
const { mockResetCredits, setBalance } = jest.requireMock<typeof import('../credits/__mocks__/CreditsProvider')>('../credits/CreditsProvider');
const { mockResetAccess, applyPurchase, applyOffer, MOCK_OFFER } = jest.requireMock<typeof import('./__mocks__/AccessProvider')>('./AccessProvider');
const mockedPurchase = purchaseAccess as jest.Mock;

const OK = { orderId: 'o1', accessUntil: new Date(Date.now() + 90 * 86400000).toISOString(), bonus: 100, balance: 112 };

beforeEach(() => {
  jest.clearAllMocks();
  mockResetCredits(12);
  mockResetAccess();
});

it('buys at the shown offer, applies the plan and the new balance', async () => {
  mockedPurchase.mockResolvedValue(OK);
  const { result } = await renderHook(() => useAccessPurchase());
  let ok: boolean | undefined;
  await act(async () => {
    ok = await result.current.purchase();
  });
  expect(ok).toBe(true);
  expect(mockedPurchase).toHaveBeenCalledWith(MOCK_OFFER);
  expect(applyPurchase).toHaveBeenCalledWith(OK);
  expect(setBalance).toHaveBeenCalledWith(112);
  expect(result.current.error).toBeNull();
  expect(result.current.pending).toBe(false);
});

it('a second call while one is in flight does nothing', async () => {
  let resolve!: (v: typeof OK) => void;
  mockedPurchase.mockReturnValue(new Promise((r) => (resolve = r)));
  const { result } = await renderHook(() => useAccessPurchase());
  let first!: Promise<boolean>;
  let second!: Promise<boolean>;
  await act(async () => {
    first = result.current.purchase();
    second = result.current.purchase();
  });
  expect(result.current.pending).toBe(true);
  expect(await second).toBe(false);
  await act(async () => resolve(OK));
  expect(await first).toBe(true);
  expect(mockedPurchase).toHaveBeenCalledTimes(1);
});

it('offer_changed shows the new offer and asks again', async () => {
  const fresh = { priceBani: 20000, bonusCredits: 50, durationMonths: 6 };
  mockedPurchase.mockRejectedValue(new AccessApiError('offer_changed', 'x', fresh));
  const { result } = await renderHook(() => useAccessPurchase());
  let ok: boolean | undefined;
  await act(async () => {
    ok = await result.current.purchase();
  });
  expect(ok).toBe(false);
  expect(applyOffer).toHaveBeenCalledWith(fresh);
  expect(result.current.offerChanged).toBe(true);
  expect(result.current.error).toBe(OFFER_CHANGED);
  expect(OFFER_CHANGED).toBe('Oferta s-a schimbat. Verifică noul preț.');
  expect(applyPurchase).not.toHaveBeenCalled();
});

it('any other failure shows its message', async () => {
  mockedPurchase.mockRejectedValue(new AccessApiError('server_error', 'Cumpărarea nu a reușit. Încearcă din nou.'));
  const { result } = await renderHook(() => useAccessPurchase());
  await act(async () => void (await result.current.purchase()));
  expect(result.current.error).toBe('Cumpărarea nu a reușit. Încearcă din nou.');
  expect(result.current.offerChanged).toBe(false);
});

it('does nothing without an offer', async () => {
  mockResetAccess({ offer: null });
  const { result } = await renderHook(() => useAccessPurchase());
  await act(async () => void (await result.current.purchase()));
  expect(mockedPurchase).not.toHaveBeenCalled();
});
