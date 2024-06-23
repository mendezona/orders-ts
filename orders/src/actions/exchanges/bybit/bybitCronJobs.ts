import * as Sentry from "@sentry/nextjs";
import { Client } from "@upstash/qstash";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import Decimal from "decimal.js";
import { getLatestFlipAlertForSymbol } from "~/server/queries";
import { type FlipAlertItem } from "~/server/queries.types";
import { getNextIntervalTimeFor24Hour7DayMarket } from "../exchanges.utils";
import {
  type BybitCheckLatestPriceAndReverseTradeCronJobParams,
  type BybitSchedulePriceCheckAtNextInternalCronJobParams,
  type BybitSubmitPairTradeOrderParams,
} from "./bybit.types";
import { bybitGetLatestTradedPrice } from "./bybitOrders.helpers";
import { bybitSubmitPairTradeOrder } from "./bybitOrders.utils";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Schedules a cron job to check the price at the next defined interval.
 *
 * @param tradingViewSymbol - The asset ticker symbol.
 * @param tradingViewPrice - Price of the TradingView alert.
 * @param tradingViewInterval - The interval in minutes defined by the TradingView alert.
 * @param buyAlert - If alert is a buy or a sell alert (intended to flip long to short or vice versa).
 */
export const bybitSchedulePriceCheckAtNextIntervalCronJob = async ({
  tradingViewSymbol,
  tradingViewPrice,
  tradingViewInterval,
  buyAlert,
}: BybitSchedulePriceCheckAtNextInternalCronJobParams): Promise<void> => {
  if (!process.env.QSTASH_URL || !process.env.QSTASH_TOKEN) {
    throw new Error(
      "bybitSchedulePriceCheckAtNextIntervalCronJob - environment variables are not defined",
    );
  }

  console.log(
    `Cron job start - bybitSchedulePriceCheckAtNextIntervalCronJob - Scheduling cron job with ticker: ${tradingViewSymbol}, price: ${tradingViewPrice}, and interval: ${tradingViewInterval} minutes`,
  );

  // Get the next interval time
  const now = dayjs.utc();
  console.log(`Current UTC time: ${now.toISOString()}`);
  const nextTime = getNextIntervalTimeFor24Hour7DayMarket(
    now,
    parseInt(tradingViewInterval, 10),
  );

  // Schedule the job using qstash
  const client = new Client({ token: process.env.QSTASH_TOKEN });
  const jobData: BybitCheckLatestPriceAndReverseTradeCronJobParams = {
    tradingViewSymbol,
    buyAlert,
  };
  const delayInSeconds: number = nextTime.diff(now, "second");

  try {
    const response = await client.publishJSON({
      url: "https://orders-ts.vercel.app/api/bybit/checkpriceatnextinterval",
      delay: delayInSeconds,
      body: JSON.stringify(jobData),
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    console.log(
      "Cron job end - bybitSchedulePriceCheckAtNextIntervalCronJob - Cron job scheduled successfully",
    );
    console.log(response);
  } catch (error) {
    Sentry.captureException(error);
    console.error(
      "Cron job error - bybitSchedulePriceCheckAtNextIntervalCronJob - Failed to schedule cron job:",
      error,
    );
    throw error;
  }
};

/**
 * Reverses the trade for the specified asset ticker symbol if last trade price is greater than quote price.
 *
 * @param tradingViewSymbol - The asset or crypto ticker symbol.
 * @param buyAlert - If alert is a buy or a sell alert (intended to flip long to short or vice versa).
 */
export const bybitCheckLatestPriceAndReverseTradeCronJob = async ({
  tradingViewSymbol,
  buyAlert,
}: BybitCheckLatestPriceAndReverseTradeCronJobParams): Promise<void> => {
  console.log(
    `Cron job start - bybitCheckLatestPriceAndReverseTradeCronJob - Scheduling price check and potential reverse trade for: ${tradingViewSymbol}.`,
  );

  const latestFlipAlert: FlipAlertItem =
    await getLatestFlipAlertForSymbol(tradingViewSymbol);
  const lastTradePrice: Decimal = new Decimal(latestFlipAlert.price);
  const lastTradedPrice = await bybitGetLatestTradedPrice(tradingViewSymbol);

  console.log(
    `${tradingViewSymbol}, buy alert: ${buyAlert}, last trade price: ${lastTradePrice.toString()}, quote price: ${lastTradedPrice.toString()}`,
  );

  if (
    (buyAlert && lastTradePrice.greaterThan(lastTradedPrice)) ||
    (!buyAlert && lastTradePrice.lessThan(lastTradedPrice))
  ) {
    console.log("Cron job - reverse trade initiated");
    try {
      await bybitSubmitPairTradeOrder({
        tradingViewSymbol: tradingViewSymbol,
        tradingViewPrice: lastTradedPrice.toString(),
        buyAlert: !buyAlert,
        scheduleCronJob: false,
      } as BybitSubmitPairTradeOrderParams);

      console.log(
        `Cron job end - bybitCheckLatestPriceAndReverseTradeCronJob - successful for for: ${tradingViewSymbol}.`,
      );
    } catch (error) {
      Sentry.captureException(error);
      console.error(
        "Cron job error - bybitCheckLatestPriceAndReverseTradeCronJob - Failed to execute reverse trade",
        error,
      );
      throw error;
    }
  } else {
    console.log("Cron job end - no trades initiated");
  }
};
