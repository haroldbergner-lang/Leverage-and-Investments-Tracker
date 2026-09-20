import { getHoldingsFromCopilot } from './copilot.js';
import { leverageFactorFor, underlyingFor } from './leverage.js';

export async function computePortfolio() {
  const rawHoldings = await getHoldingsFromCopilot();

  const positions = rawHoldings
    .filter((h) => !h.is_cash_equivalent)
    .map((h) => {
      const factor = leverageFactorFor(h.ticker_symbol);
      const absFactor = Math.abs(factor);
      const value = h.institution_value ?? 0;
      return {
        symbol: h.ticker_symbol ?? '(unknown)',
        name: h.name,
        account: h.account_name,
        quantity: h.quantity,
        price: h.institution_price,
        value,
        factor,
        underlying: underlyingFor(h.ticker_symbol),
        leveraged: absFactor > 1,
        notional: value * absFactor,
      };
    });

  const cashValue = rawHoldings
    .filter((h) => h.is_cash_equivalent)
    .reduce((sum, h) => sum + (h.institution_value ?? 0), 0);

  const positionsValue = positions.reduce((sum, p) => sum + p.value, 0);
  const positionsNotional = positions.reduce((sum, p) => sum + p.notional, 0);
  const leveragedValue = positions.filter((p) => p.leveraged).reduce((sum, p) => sum + p.value, 0);

  const totalValue = positionsValue + cashValue;
  const totalNotional = positionsNotional + cashValue;

  return {
    positions,
    cashValue,
    totalValue,
    totalNotional,
    leveragedValue,
    leverageRatio: totalValue > 0 ? totalNotional / totalValue : 0,
    leveragedShare: totalValue > 0 ? leveragedValue / totalValue : 0,
  };
}
