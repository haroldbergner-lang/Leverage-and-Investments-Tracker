// Curated table of common leveraged/inverse ETFs. `factor` is the signed
// daily multiple vs. the underlying index/sector (negative = inverse fund).
// Any ticker not listed here is treated as unleveraged (1x) — the default
// for ordinary stocks, single-stock positions, and most ETFs/mutual funds.
export const LEVERAGED_ETFS = {
  // Nasdaq-100
  TQQQ: { factor: 3, underlying: 'Nasdaq-100' },
  SQQQ: { factor: -3, underlying: 'Nasdaq-100' },
  QLD: { factor: 2, underlying: 'Nasdaq-100' },
  QID: { factor: -2, underlying: 'Nasdaq-100' },

  // S&P 500
  UPRO: { factor: 3, underlying: 'S&P 500' },
  SPXL: { factor: 3, underlying: 'S&P 500' },
  SPXU: { factor: -3, underlying: 'S&P 500' },
  SSO: { factor: 2, underlying: 'S&P 500' },
  SDS: { factor: -2, underlying: 'S&P 500' },

  // Russell 2000
  TNA: { factor: 3, underlying: 'Russell 2000' },
  TZA: { factor: -3, underlying: 'Russell 2000' },

  // Dow Jones
  UDOW: { factor: 3, underlying: 'Dow Jones' },
  SDOW: { factor: -3, underlying: 'Dow Jones' },

  // Sectors
  SOXL: { factor: 3, underlying: 'Semiconductors' },
  SOXS: { factor: -3, underlying: 'Semiconductors' },
  FAS: { factor: 3, underlying: 'Financials' },
  FAZ: { factor: -3, underlying: 'Financials' },
  TECL: { factor: 3, underlying: 'Technology' },
  TECS: { factor: -3, underlying: 'Technology' },
  LABU: { factor: 3, underlying: 'Biotech' },
  LABD: { factor: -3, underlying: 'Biotech' },

  // International
  YINN: { factor: 3, underlying: 'China Large-Cap' },
  YANG: { factor: -3, underlying: 'China Large-Cap' },

  // Commodities
  NUGT: { factor: 2, underlying: 'Gold Miners' },
  DUST: { factor: -2, underlying: 'Gold Miners' },
  JNUG: { factor: 2, underlying: 'Junior Gold Miners' },
  JDST: { factor: -2, underlying: 'Junior Gold Miners' },
  BOIL: { factor: 2, underlying: 'Natural Gas' },
  KOLD: { factor: -2, underlying: 'Natural Gas' },
  UCO: { factor: 2, underlying: 'Crude Oil' },
  SCO: { factor: -2, underlying: 'Crude Oil' },

  // Volatility
  UVXY: { factor: 1.5, underlying: 'VIX Short-Term Futures' },
  SVXY: { factor: -0.5, underlying: 'VIX Short-Term Futures' },
};

export function leverageFactorFor(symbol) {
  if (!symbol) return 1;
  return LEVERAGED_ETFS[symbol.toUpperCase()]?.factor ?? 1;
}

export function underlyingFor(symbol) {
  if (!symbol) return null;
  return LEVERAGED_ETFS[symbol.toUpperCase()]?.underlying ?? null;
}
