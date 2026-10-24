// Number formatting shared by log text (src/data) and the UI.

export const formatMoney = (amount: number) =>
  amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/** $278k style, for home prices. */
export const formatCompactMoney = (amount: number) => `$${Math.round(amount / 1_000)}k`

/** 0.432 -> "43%". Pass digits for "43.2%". */
export const formatPercent = (ratio: number, digits = 0) => `${(ratio * 100).toFixed(digits)}%`

/** Rates are stored in percent already: 7.125 -> "7.125%". */
export const formatRate = (ratePct: number) => `${Number(ratePct.toFixed(3))}%`
