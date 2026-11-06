import { describe, expect, it } from 'vitest';
import { orderStatusLabel } from './students';

describe('orderStatusLabel', () => {
  it('an order approved without a payment provider is not shown as paid', () => {
    expect(orderStatusLabel({ status: 'approved', provider: 'none' })).toBe('Aprobată (fără plată)');
  });
  it('an order approved by a real provider is paid', () => {
    expect(orderStatusLabel({ status: 'approved', provider: 'stripe' })).toBe('Plătită');
  });
  it('pending, failed and unknown states', () => {
    expect(orderStatusLabel({ status: 'pending', provider: 'none' })).toBe('În așteptare');
    expect(orderStatusLabel({ status: 'failed', provider: 'stripe' })).toBe('Eșuată');
    expect(orderStatusLabel({ status: 'weird', provider: 'none' })).toBe('weird');
  });
});
