/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as Sentry from "@sentry/nextjs";
import Decimal from "decimal.js";
import { and, gt, gte, lte } from "drizzle-orm";
import { db } from "./db";
import { sellTrades } from "./db/schema";
import { getFinancialYearDates } from "./queries.helpers";
import { type SaveTradeToDatabaseProps } from "./queries.types";

export const getLatestProfitAmountCurrentFinancialYear =
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
            gt(sellTrades.profitOrLossAmount, "0"),
          ),
        );

      if (profitableTrades.length === 0) {
        return "0";
      }

      const totalProfit = profitableTrades.reduce((sum, trade) => {
        return sum.plus(new Decimal(trade.profitOrLossAmount));
      }, new Decimal(0));

      return totalProfit.toFixed(2);
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  };

export const saveTradeToDatabase = async ({
  symbol,
  profitOrLossAmount,
  taxableAmount,
}: SaveTradeToDatabaseProps) => {
  try {
    await db.insert(sellTrades).values({
      symbol,
      profitOrLossAmount,
      taxableAmount,
    });
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
};
