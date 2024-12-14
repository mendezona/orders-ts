import * as Sentry from "@sentry/nextjs";
import { Client } from "@upstash/qstash";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import Decimal from "decimal.js";
import { ORDER_TS_BASE_URL } from "~/actions/actions.constants";
import { getLatestFlipAlertForSymbol } from "~/server/queries";
import { NEW_YORK_TIMEZONE } from "../exchanges.constants";
import {
  type AlpacaCheckLatestPriceAndReverseTradeCronJobParams,
  type AlpacaSchedulePriceCheckAtNextInternalCronJobParams,
  type AlpacaSubmitPairTradeOrderParams,
} from "./alpaca.types";
import {
  getAlpacaNextAvailableTradingDay,
  getAlpacaNextIntervalTime,
} from "./alpacaCronJob.helpers";
import { alpacaGetLatestQuote } from "./alpacaOrders.helpers";
import {
  alpacaCancelAllOpenOrders,
  alpacaSubmitPairTradeOrder,
} from "./alpacaOrders.utils";

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
  const nextTime = await getAlpacaNextIntervalTime(
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
      url: `${ORDER_TS_BASE_URL}/api/alpaca/checkpriceatnextinterval`,
      delay: delayInSeconds,
      body: JSON.stringify(jobData),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      retries: 1,
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
 * @param buyAlert - If alert is a buy or a sell alert (intended to flip long to short or vice versa). This should be set to the original alert, eg. if alert was to go long this should be set to true.
 */
export const alpacaCheckLatestPriceAndReverseTradeCronJob = async ({
  tradingViewSymbol,
  buyAlert,
}: AlpacaCheckLatestPriceAndReverseTradeCronJobParams): Promise<void> => {
  console.log(
    `Cron job start - alpacaCheckLatestPriceAndReverseTradeCronJob - Scheduling price check for: ${tradingViewSymbol}`,
  );

  try {
    const [latestFlipAlert, getQuote] = await Promise.all([
      getLatestFlipAlertForSymbol(tradingViewSymbol),
      alpacaGetLatestQuote(tradingViewSymbol),
    ]);

    const lastTradePrice = new Decimal(latestFlipAlert.price);
    const quotePrice = getQuote.askPrice.gt(0)
      ? getQuote.askPrice
      : getQuote.bidPrice;

    console.log(
      `${tradingViewSymbol}, buy alert: ${buyAlert}, last trade price: ${lastTradePrice.toString()}, quote price: ${quotePrice.toString()}`,
    );

    const shouldReverseTrade = buyAlert
      ? lastTradePrice.greaterThan(quotePrice)
      : lastTradePrice.lessThan(quotePrice);

    if (!shouldReverseTrade) {
      console.log("Cron job end - no trades initiated");
      return;
    }

    console.log("Cron job - reverse trade initiated");
    await alpacaCancelAllOpenOrders();
    await alpacaSubmitPairTradeOrder({
      tradingViewSymbol,
      tradingViewPrice: quotePrice.toString(),
      buyAlert: !buyAlert,
      scheduleCronJob: false,
      submitTakeProfitOrder: false,
    } as AlpacaSubmitPairTradeOrderParams);

    console.log(
      `Cron job end - alpacaCheckLatestPriceAndReverseTradeCronJob - successful for: ${tradingViewSymbol}`,
    );
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        tradingViewSymbol,
        buyAlert,
      },
    });
    console.error(
      "Cron job error - alpacaCheckLatestPriceAndReverseTradeCronJob - Failed to execute reverse trade",
      error,
    );
    throw error;
  }
};

/**
 * Schedules a cron job to submit a fractionable take profit order at 3 AM NY time. Fractionable orders only allow time in force of day therefore this cron job is scheduled every trading day.
 */
export const scheduleFractionableTakeProfitOrderCronJob =
  async (): Promise<void> => {
    const now = dayjs().tz(NEW_YORK_TIMEZONE);
    const { nextSessionOpen } = await getAlpacaNextAvailableTradingDay(now);

    // Convert nextSessionOpen to UTC
    const utcDateTime = nextSessionOpen.utc();

    // Extract minute, hour, day, and month for the cron expression
    const minute = utcDateTime.minute();
    const hour = utcDateTime.hour();
    const dayOfMonth = utcDateTime.date();
    const month = utcDateTime.month() + 1; // month() returns 0-11, cron uses 1-12

    // Build the cron expression
    const cronExpression = `${minute} ${hour} ${dayOfMonth} ${month} *`;

    console.log(
      `Scheduling fractionable take profit order for ${nextSessionOpen.format(
        "YYYY-MM-DD HH:mm:ss z",
      )} NY time, which is ${utcDateTime.format("YYYY-MM-DD HH:mm:ss [UTC]")} UTC`,
    );

    const client = new Client({ token: process.env.QSTASH_TOKEN ?? "" });
    await client.schedules.create({
      destination: `${ORDER_TS_BASE_URL}/api/alpaca/submittakeprofitorderforfractionableassets`,
      cron: cronExpression,
    });
  };
