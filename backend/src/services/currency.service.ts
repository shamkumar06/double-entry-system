import axios from 'axios';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/errorHandler';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache — plan rule #6.3

// ── Fetch rates from API, respecting TTL cache ─────────────────────────────
export const getExchangeRates = async (baseCurrency = 'INR'): Promise<Record<string, number>> => {
  // 1. Check DB cache first
  const settings = await prisma.systemSettings.findFirst();

  if (settings?.cachedRates && settings?.ratesCachedAt) {
    const age = Date.now() - new Date(settings.ratesCachedAt).getTime();
    if (age < CACHE_TTL_MS) {
      console.log('[Currency] Returning cached exchange rates.');
      return settings.cachedRates as Record<string, number>;
    }
  }

  // 2. Cache is stale or missing — fetch from API
  const apiKey = settings?.exchangeRateApiKey || process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    throw new ApiError(500, 'Exchange Rate API key not configured.');
  }

  const url = `${process.env.EXCHANGE_RATE_API_URL}/${apiKey}/latest/${baseCurrency}`;

  try {
    console.log('[Currency] Fetching fresh rates from exchangerate-api.com...');
    const response = await axios.get<{
      result: string;
      conversion_rates: Record<string, number>;
    }>(url, { timeout: 10000 });

    if (response.data.result !== 'success') {
      throw new ApiError(502, 'Exchange Rate API returned an error.');
    }

    const rates = response.data.conversion_rates;

    // 3. Persist to DB cache
    await prisma.systemSettings.upsert({
      where: { id: settings?.id || '' },
      create: {
        baseCurrency,
        cachedRates: rates,
        ratesCachedAt: new Date(),
      },
      update: {
        cachedRates: rates,
        ratesCachedAt: new Date(),
      },
    });

    return rates;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, 'Failed to fetch exchange rates. Please try again later.');
  }
};

// ── Convert an amount from one currency to another ────────────────────────
export const convertAmount = async (
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  baseCurrency = 'INR'
): Promise<{ convertedAmount: number; rate: number }> => {
  if (fromCurrency === toCurrency) {
    return { convertedAmount: amount, rate: 1 };
  }

  const rates = await getExchangeRates(baseCurrency);

  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];

  if (!fromRate || !toRate) {
    throw new ApiError(400, `Unsupported currency code: ${fromCurrency} or ${toCurrency}`);
  }

  // Convert via base currency: amount in fromCurrency → base → toCurrency
  const amountInBase = amount / fromRate;
  const convertedAmount = parseFloat((amountInBase * toRate).toFixed(2));
  const rate = parseFloat((toRate / fromRate).toFixed(6));

  return { convertedAmount, rate };
};

// ── Update system settings (admin only) ──────────────────────────────────
export const updateSystemSettings = async (data: {
  baseCurrency?: string;
  exchangeRateApiKey?: string;
}) => {
  const existing = await prisma.systemSettings.findFirst();
  return prisma.systemSettings.upsert({
    where: { id: existing?.id || '' },
    create: { ...data },
    update: { ...data },
  });
};

// ── Get system settings ────────────────────────────────────────────────────
export const getSystemSettings = async () => {
  const settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    return { baseCurrency: 'INR', exchangeRateApiKey: null };
  }
  const { exchangeRateApiKey: _hidden, cachedRates: _cache, ...safeSettings } = settings;
  return safeSettings;
};
