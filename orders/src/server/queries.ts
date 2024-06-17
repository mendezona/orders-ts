/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as Sentry from "@sentry/nextjs";
import { and, desc, gte, lte } from "drizzle-orm";
import { db } from "./db";
import { sellTrades } from "./db/schema";
import { getFinancialYearDates } from "./queries.helpers";
import { type SaveTradeToDatabaseProps } from "./queries.types";

export const getLatestProfitAmountCurrentFinancialYear =
  async (): Promise<string> => {
    try {
      const { startOfYear, endOfYear } = getFinancialYearDates();

      const latestProfit = await db
        .select()
        .from(sellTrades)
        .where(
          and(
            gte(sellTrades.tradeTime, startOfYear),
            lte(sellTrades.tradeTime, endOfYear),
          ),
        )
        .orderBy(desc(sellTrades.id))
        .limit(1);

      if (
        latestProfit[0] &&
        latestProfit.length > 0 &&
        latestProfit[0].profitOrLossAmount !== null
      ) {
        return latestProfit[0].profitOrLossAmount;
      }

      throw new Error("No profits found");
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
