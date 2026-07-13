import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

// Regression guard for a real bug that shipped: a blank "Retention %" input
// submits "" (not undefined), and z.coerce.number() alone coerces "" to 0
// BEFORE .optional() ever runs - so leaving the field blank silently sent a
// real, valid 0 that overrode the contract's actual retention rate, instead
// of falling back to it. Confirmed live in PaymentCertificatesView; fixed
// with z.preprocess() turning "" into undefined first. These import the
// REAL schemas from the components (exported for exactly this purpose)
// rather than reimplementing them, so a future edit that reintroduces the
// bug in the actual source fails this test.
import { schema as paymentCertificateSchema } from '@/components/forms/PaymentCertificatesView';
import { schema as contractSchema } from '@/components/forms/ContractView';

describe('blank optional-number coercion (retention_percentage)', () => {
  it('PaymentCertificatesView: a blank retention_percentage parses to undefined, not 0', () => {
    const result = paymentCertificateSchema.safeParse({
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      work_completed_value: '100000',
      retention_percentage: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.retention_percentage).toBeUndefined();
    }
  });

  it('PaymentCertificatesView: an explicit 0 is preserved as a real value, not treated as blank', () => {
    const result = paymentCertificateSchema.safeParse({
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      work_completed_value: '100000',
      retention_percentage: '0',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.retention_percentage).toBe(0);
    }
  });

  it('ContractView: a blank retention_percentage and contract_value both parse to undefined, not 0', () => {
    const result = contractSchema.safeParse({
      retention_percentage: '',
      contract_value: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.retention_percentage).toBeUndefined();
      expect(result.data.contract_value).toBeUndefined();
    }
  });
});
