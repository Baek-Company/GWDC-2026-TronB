import DecimalBase from 'decimal.js';
import { z } from 'zod';

// 78 integer digits for uint256, plus guard digits for rate arithmetic.
const Decimal = DecimalBase.clone({ precision: 128 });

export const profileSchema = z.object({
  asset: z.enum(['USDT', 'USDD', 'TRX']),
  amount: z.string().regex(/^\d+(\.\d+)?$/).refine(v => new Decimal(v).gt(0)),
  horizonDays: z.number().int().min(1).max(3650),
  liquidReserve: z.string().regex(/^\d+(\.\d+)?$/),
  riskPreference: z.enum(['conservative', 'balanced', 'growth']),
}).refine(v => new Decimal(v.liquidReserve).lte(v.amount), '필요 유동성이 보유액보다 큽니다.');

// Read-only preview: money needed before the plan ends stays outside the investable amount.
export function previewLiquidity(input: {
  holdings: string; horizonDays: number; expense: string; expenseDay: number; reserve: string;
}) {
  for (const value of [input.holdings, input.expense, input.reserve]) {
    if (!/^\d+(\.\d+)?$/.test(value)) throw new Error('금액을 0 이상의 숫자로 입력해 주세요.');
  }
  if (!Number.isInteger(input.horizonDays) || input.horizonDays < 1 || input.horizonDays > 3650
    || !Number.isInteger(input.expenseDay) || input.expenseDay < 1 || input.expenseDay > 3650) {
    throw new Error('운용 기간과 지출일은 1~3650일로 입력해 주세요.');
  }
  const holdings = new Decimal(input.holdings);
  const expense = new Decimal(input.expense);
  const reserve = new Decimal(input.reserve);
  if (!holdings.gt(0)) throw new Error('보유 금액은 0보다 커야 합니다.');
  if (expense.gt(holdings)) throw new Error('예정 지출이 보유 금액보다 큽니다.');
  const dueWithinHorizon = input.expenseDay <= input.horizonDays;
  const protectedAmount = reserve.plus(dueWithinHorizon ? expense : 0);
  if (protectedAmount.gt(holdings)) throw new Error('지출액과 예비액의 합계가 보유 금액보다 큽니다.');
  return {
    dueWithinHorizon,
    protectedAmount: protectedAmount.toString(),
    investableAmount: holdings.minus(protectedAmount).toString(),
  };
}

// Mathematical utility for later planning. Inputs are assumptions, not a product recommendation.
// Base rate is effective APY; reward rate is a simple annual reward assumption.
export function estimateYield(input: {
  principal: string; days: number; baseApy: string; rewardApr: string; totalCost: string;
}) {
  if (!Number.isInteger(input.days) || input.days < 0 || input.days > 3650) throw new Error('Invalid horizon');
  for (const value of [input.principal, input.baseApy, input.rewardApr, input.totalCost]) {
    if (!/^\d+(\.\d+)?$/.test(value)) throw new Error('Invalid non-negative decimal');
  }
  const time = new Decimal(input.days).div(365);
  const principal = new Decimal(input.principal);
  const base = principal.times(new Decimal(1).plus(input.baseApy).pow(time).minus(1));
  const rewards = principal.times(input.rewardApr).times(time);
  return { baseYield: base.toFixed(8), rewardYield: rewards.toFixed(8),
    totalCost: new Decimal(input.totalCost).toFixed(8),
    netYield: base.plus(rewards).minus(input.totalCost).toFixed(8) };
}
