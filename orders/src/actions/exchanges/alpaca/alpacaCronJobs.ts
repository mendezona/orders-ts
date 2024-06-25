import * as Sentry from "@sentry/nextjs";
import { Client } from "@upstash/qstash";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import Decimal from "decimal.js";
import { QSTASH_ALPACA_CRON_JOB_PRICE_CHECK_INTERVAL_TOPIC } from "~/actions/actions.constants";
import { getLatestFlipAlertForSymbol } from "~/server/queries";
import { type FlipAlertItem } from "~/server/queries.types";
import {
  type AlpacaCheckLatestPriceAndReverseTradeCronJobParams,
  type AlpacaSchedulePriceCheckAtNextInternalCronJobParams,
  type AlpacaSubmitPairTradeOrderParams,
} from "./alpaca.types";
import { alpacaGetNextIntervalTime } from "./alpacaCronJob.helpers";
import { alpacaGetLatestQuote } from "./alpacaOrders.helpers";
import { alpacaSubmitPairTradeOrder } from "./alpacaOrders.utils";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Schedules a cron job to check the price at the next defined interval.
 *
 * @param tradingViewSymbol - The stock ticker symbol.
 * @param tradingViewPrice - Price of the TradingView alert.
 * @param tradingViewInterval - The interval in minutes defined by the TradingView alert.
 * @param buyAlert - If alert is a buy or a sell alert (intended to flip long to short or vice versa).
 */
export const alpacaSchedulePriceCheckAtNextIntervalCronJob = async ({
  tradingViewSymbol,
  tradingViewPrice,
  tradingViewInterval,
  buyAlert,
}: AlpacaSchedulePriceCheckAtNextInternalCronJobParams): Promise<void> => {
  if (!process.env.QSTASH_URL || !process.env.QSTASH_TOKEN) {
    const errorMessage =
      "alpacaSchedulePriceCheckAtNextIntervalCronJob - environment variables are not defined";
    console.log(errorMessage);
    Sentry.captureMessage(errorMessage);
    throw new Error(errorMessage);
  }

  console.log(
    `Cron job start - alpacaSchedulePriceCheckAtNextIntervalCronJob - Scheduling cron job with ticker: ${tradingViewSymbol}, price: ${tradingViewPrice}, and interval: ${tradingViewInterval} minutes`,
  );

  // Get the next interval time
  const now = dayjs.utc();
  console.log(`Current UTC time: ${now.toISOString()}`);
  const nextTime = await alpacaGetNextIntervalTime(
    now,
    parseInt(tradingViewInterval, 10),
  );

  // Schedule the job using qstash
  const client = new Client({ token: process.env.QSTASH_TOKEN });
  const jobData: AlpacaCheckLatestPriceAndReverseTradeCronJobParams = {
    tradingViewSymbol,
    buyAlert,
  };
  const delayInSeconds: number = nextTime.diff(now, "second");

  try {
    const response = await client.publish({
      topic: QSTASH_ALPACA_CRON_JOB_PRICE_CHECK_INTERVAL_TOPIC,
      delay: delayInSeconds,
      body: JSON.stringify(jobData),
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    console.log(
      "Cron job end - alpacaSchedulePriceCheckAtNextIntervalCronJob - Cron job scheduled successfully",
    );
    console.log(response);
  } catch (error) {
    Sentry.captureException(error);
    console.error(
      "Cron job error - alpacaSchedulePriceCheckAtNextIntervalCronJob - Failed to schedule cron job:",
      error,
    );
    throw error;
  }
};

/**
 * Reverses the trade for the specified stock ticker symbol if last trade price is greater than quote price.
 *
 * @param tradingViewSymbol - The stock or crypto ticker symbol.
 * @param buyAlert - If alert is a buy or a sell alert (intended to flip long to short or vice versa).
 */
export const alpacaCheckLatestPriceAndReverseTradeCronJob = async ({
  tradingViewSymbol,
  buyAlert,
}: AlpacaCheckLatestPriceAndReverseTradeCronJobParams): Promise<void> => {
  console.log(
    `Cron job start - alpacaCheckLatestPriceAndReverseTradeCronJob - Scheduling price check and potential reverse trade for: ${tradingViewSymbol}.`,
  );

  const latestFlipAlert: FlipAlertItem =
    await getLatestFlipAlertForSymbol(tradingViewSymbol);
  const lastTradePrice: Decimal = new Decimal(latestFlipAlert.price);
  const getQuote = await alpacaGetLatestQuote(tradingViewSymbol);
  const quotePrice: Decimal = getQuote.askPrice.gt(0)
    ? getQuote.askPrice
    : getQuote.bidPrice;

  console.log(
    `${tradingViewSymbol}, buy alert: ${buyAlert}, last trade price: ${lastTradePrice.toString()}, quote price: ${quotePrice.toString()}`,
  );

  if (
    (buyAlert && lastTradePrice.greaterThan(quotePrice)) ||
    (!buyAlert && lastTradePrice.lessThan(quotePrice))
  ) {
    console.log("Cron job - reverse trade initiated");
    try {
      await alpacaSubmitPairTradeOrder({
        tradingViewSymbol: tradingViewSymbol,
        tradingViewPrice: quotePrice.toString(),
        buyAlert: !buyAlert,
        scheduleCronJob: false,
      } as AlpacaSubmitPairTradeOrderParams);

      console.log(
        `Cron job end - alpacaCheckLatestPriceAndReverseTradeCronJob - successful for for: ${tradingViewSymbol}.`,
      );
    } catch (error) {
      Sentry.captureException(error);
      console.error(
        "Cron job error - alpacaCheckLatestPriceAndReverseTradeCronJob - Failed to execute reverse trade",
        error,
      );
      throw error;
    }
  } else {
    console.log("Cron job end - no trades initiated");
  }
};
