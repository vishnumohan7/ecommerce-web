import { describe, expect, it } from 'vitest';
describe('rate-limit policy', () => {
  const policy = { loginAccount: [5, 900], loginIp: [20, 900], otpHour: [3, 3600], otpDay: [10, 86400], otpVerify: [5, 600], passwordReset: [3, 3600] } as const;
  it('contains the mandated strict buckets', () => { expect(policy.loginAccount).toEqual([5, 900]); expect(policy.loginIp).toEqual([20, 900]); expect(policy.otpHour).toEqual([3, 3600]); expect(policy.otpDay).toEqual([10, 86400]); expect(policy.otpVerify[0]).toBe(5); expect(policy.passwordReset).toEqual([3, 3600]); });
});
