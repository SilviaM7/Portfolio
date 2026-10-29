import { priceEvents, type Budget, type PricedEvent, type PriceEntry } from '@/analysis/spend';
import { fetchAll, reportFor, type FileReport } from '@/data/dataset';
import { BUDGET_FILE, normalizeBudgets, normalizePrices, normalizeUsageEvents, PRICING_FILE, USAGE_FILE } from './schema';

export const SPEND_DIR = 'data/ai-spend';

export interface SpendDataset {
  events: PricedEvent[];
  prices: PriceEntry[];
  budgets: Budget[];
  reports: FileReport[];
}

/** Download, validate, and price the AI Spend dataset. Throws DataError with a helpful message on failure. */
export async function loadSpendDataset(signal?: AbortSignal): Promise<SpendDataset> {
  const [usageCsv, pricingCsv, budgetCsv] = await fetchAll([`${SPEND_DIR}/${USAGE_FILE}`, `${SPEND_DIR}/${PRICING_FILE}`, `${SPEND_DIR}/${BUDGET_FILE}`], signal);
  if (usageCsv === undefined || pricingCsv === undefined || budgetCsv === undefined) throw new Error('Dataset download returned fewer files than requested.');
  const usage = normalizeUsageEvents(usageCsv.headers, usageCsv.rows);
  const pricing = normalizePrices(pricingCsv.headers, pricingCsv.rows);
  const budgets = normalizeBudgets(budgetCsv.headers, budgetCsv.rows);
  const events = priceEvents(usage.rows, pricing.rows);
  return {
    events,
    prices: pricing.rows,
    budgets: budgets.rows,
    reports: [reportFor(USAGE_FILE, usage, usageCsv), reportFor(PRICING_FILE, pricing, pricingCsv), reportFor(BUDGET_FILE, budgets, budgetCsv)],
  };
}
