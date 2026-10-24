import { formatCompactMoney, formatMoney, formatPercent } from '../engine/format'
import type { StatKey } from '../engine/preview'

// One place for how each stat is named and printed, shared by the stat panel
// and every preview so the same number always looks the same.

export const STAT_LABELS: Record<StatKey, string> = {
  maxPrice: 'Max home price',
  score: 'Credit score',
  dti: 'Debt-to-income',
  utilization: 'Card utilization',
  cash: 'Cash',
  monthlySavings: 'Monthly savings',
}

/** Compact names for previews on cards, where space is tight. */
export const STAT_SHORT_LABELS: Record<StatKey, string> = {
  maxPrice: 'Max price',
  score: 'Score',
  dti: 'DTI',
  utilization: 'Utilization',
  cash: 'Cash',
  monthlySavings: 'Savings / mo',
}

/** One plain-English sentence per stat (docs/SPEC.md §14). */
export const STAT_EXPLANATIONS: Record<StatKey, string> = {
  maxPrice: 'The most expensive home the Underwriter would approve if you applied today.',
  score:
    'A 300–850 summary of how you have handled credit. Lenders need at least 620, and higher scores get lower rates.',
  dti: 'Your monthly debt payments divided by verified income. Once a mortgage is added, the total must stay under 43%.',
  utilization: 'Card balances divided by card limits. Under 30% helps your score; under 10% helps most.',
  cash: 'Pays your down payment (at least 3%), closing costs (3%) and two months of payments held in reserve.',
  monthlySavings:
    'What you add to cash each month after rent and living costs. Side-gig income lands here but not in DTI.',
}

export function formatStat(stat: StatKey, value: number): string {
  switch (stat) {
    case 'maxPrice':
      return value > 0 ? formatCompactMoney(value) : 'Denied'
    case 'score':
      return String(Math.round(value))
    case 'dti':
      return formatPercent(value, 1)
    case 'utilization':
      return formatPercent(value)
    case 'cash':
    case 'monthlySavings':
      return formatMoney(value)
  }
}
