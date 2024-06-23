/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as Sentry from "@sentry/nextjs";
import Decimal from "decimal.js";
import { and, desc, eq, gt, gte, lte } from "drizzle-orm";
import { db } from "./db";
import { flipAlerts, sellTrades } from "./db/schema";
import { getFinancialYearDates } from "./queries.helpers";
import {
  type FlipAlertItem,
  type SaveBuyTradeToDatabaseFlipTradeAlertTableProps,
  type SaveSellTradeToDatabaseSellTableProps,
} from "./queries.types";

export const getLatestTaxAmountCurrentFinancialYear =
  async (): Promise<string> => {
    try {
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

      if (profitableTrades.length === 0) {
        return "0";
      }

      const totalTaxAmount = profitableTrades.reduce((sum, trade) => {
        return sum.plus(new Decimal(trade.taxableAmount ?? 0));
      }, new Decimal(0));

      return totalTaxAmount.toFixed(2);
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  };

export const saveBuyTradeToDatabaseFlipTradeAlertTable = async ({
  exchange,
  symbol,
  price,
}: SaveBuyTradeToDatabaseFlipTradeAlertTableProps) => {
  try {
    await db.insert(flipAlerts).values({
      exchange,
      symbol,
      price,
    });
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
};

export const saveSellTradeToDatabaseSellTable = async ({
  exchange,
  symbol,
  profitOrLossAmount,
  taxableAmount,
}: SaveSellTradeToDatabaseSellTableProps) => {
  try {
    await db.insert(sellTrades).values({
      exchange,
      symbol,
      profitOrLossAmount,
      taxableAmount,
    });
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
};

export const getLatestFlipAlertForSymbol = async (
  symbol: string,
): Promise<FlipAlertItem> => {
  try {
    const latestFlipAlert = await db
      .select()
      .from(flipAlerts)
      .where(eq(flipAlerts.symbol, symbol))
      .orderBy(desc(flipAlerts.tradeTime))
      .limit(1);

    if (latestFlipAlert.length > 0) {
      return latestFlipAlert[0] as FlipAlertItem;
    }

    throw new Error(`No trades found for symbol: ${symbol}`);
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
};
