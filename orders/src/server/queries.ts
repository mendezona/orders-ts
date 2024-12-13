import Decimal from "decimal.js";
import { and, asc, desc, eq, gt, gte, lte } from "drizzle-orm";
import { db } from "./db";
import {
  flipAlerts,
  fractionableTakeProfitOrders,
  sellTrades,
} from "./db/schema";
import { getFinancialYearDates } from "./queries.helpers";
import {
  type FlipAlertItem,
  type SaveBuyTradeToDatabaseFlipTradeAlertTableProps,
  type SaveFractionableTakeProfitOrderProps,
  type SaveSellTradeToDatabaseSellTableProps,
} from "./queries.types";

export const getLatestTaxAmountCurrentFinancialYear = async () => {
  const { startOfYear, endOfYear } = getFinancialYearDates();
  const profitableTrades = await db
    .select()
    .from(sellTrades)
    .where(
      and(
        gte(sellTrades.tradeTime, startOfYear),
        lte(sellTrades.tradeTime, endOfYear),
        gt(sellTrades.taxableAmount, "0"),
      ),
    );

  if (profitableTrades.length === 0) return "0";

  const totalTaxAmount = profitableTrades.reduce((sum, trade) => {
    return sum.plus(new Decimal(trade.taxableAmount ?? 0));
  }, new Decimal(0));

  return totalTaxAmount.toFixed(2);
};

export const saveBuyTradeToDatabaseFlipTradeAlertTable = async ({
  exchange,
  symbol,
  price,
}: SaveBuyTradeToDatabaseFlipTradeAlertTableProps) =>
  await db.insert(flipAlerts).values({
    exchange,
    symbol,
    price,
  });

export const saveSellTradeToDatabaseSellTable = async ({
  exchange,
  symbol,
  profitOrLossAmount,
  taxableAmount,
}: SaveSellTradeToDatabaseSellTableProps) =>
  await db.insert(sellTrades).values({
    exchange,
    symbol,
    profitOrLossAmount,
    taxableAmount,
  });

export const getLatestFlipAlertForSymbol = async (symbol: string) => {
  const latestFlipAlert = await db
    .select()
    .from(flipAlerts)
    .where(eq(flipAlerts.symbol, symbol))
    .orderBy(desc(flipAlerts.tradeTime))
    .limit(1);

  if (latestFlipAlert.length > 0) {
    return latestFlipAlert[0] as FlipAlertItem;
  }

  throw new Error(`No saved flip alert found for symbol: ${symbol}`);
};

export const saveFractionableTakeProfitOrder = async (
  order: SaveFractionableTakeProfitOrderProps,
) => await db.insert(fractionableTakeProfitOrders).values(order);

export const getFirstFractionableTakeProfitOrder = async () => {
  const orders = await db
    .select()
    .from(fractionableTakeProfitOrders)
    .orderBy(asc(fractionableTakeProfitOrders.createdAt))
    .limit(1);

  return orders[0] ?? null;
};

export const deleteAllFractionableTakeProfitOrders = async () =>
  // eslint-disable-next-line drizzle/enforce-delete-with-where
  await db.delete(fractionableTakeProfitOrders);
