import * as Sentry from "@sentry/nextjs";
import { Client } from "@upstash/qstash";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { ORDER_TS_BASE_URL } from "~/actions/actions.constants";
import { NEW_YORK_TIMEZONE } from "../exchanges.constants";
import {
  type AlpacaCronJobSchedulePriceCheckAtNextIntervalParams,
  type AlpacaReverseTradeOnFalseSignalParams,
} from "./alpaca.types";
import {
  getAlpacaNextAvailableTradingDay,
  getAlpacaNextIntervalTime,
} from "./alpacaCronJob.helpers";

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
export const alpacaCronJobSchedulePriceCheckAtNextInterval = async ({
  tradingViewSymbol,
  tradingViewPrice,
  tradingViewInterval,
  buyAlert,
}: AlpacaCronJobSchedulePriceCheckAtNextIntervalParams) => {
  try {
    if (!process.env.QSTASH_URL || !process.env.QSTASH_TOKEN) {
      const errorMessage =
        "alpacaCronJobSchedulePriceCheckAtNextInterval - QSTASH environment variables are not defined";
      console.log(errorMessage);
      throw new Error(errorMessage);
    }

    console.log(
      `alpacaCronJobSchedulePriceCheckAtNextInterval - Scheduling cron job with ticker: ${tradingViewSymbol}, price: ${tradingViewPrice}, and interval: ${tradingViewInterval} minutes`,
    );

    const now = dayjs.utc();
    const nextTime = await getAlpacaNextIntervalTime(
      now,
      parseInt(tradingViewInterval, 10),
    );

    const client = new Client({ token: process.env.QSTASH_TOKEN });
    const jobData: AlpacaReverseTradeOnFalseSignalParams = {
      tradingViewSymbol,
      buyAlert,
    };
    const delayInSeconds: number = nextTime.diff(now, "second");

    const response = await client.publish({
      url: `${ORDER_TS_BASE_URL}/api/alpaca/checkpriceatnextinterval`,
      delay: delayInSeconds,
      body: JSON.stringify(jobData),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      retries: 1,
    });

    console.log(
      `alpacaCronJobSchedulePriceCheckAtNextInterval - Cron job scheduled successfully to check price at next interval for ${tradingViewSymbol}`,
    );
    console.log(response);
  } catch (error) {
    Sentry.captureException(error);
    console.error(
      "alpacaCronJobSchedulePriceCheckAtNextInterval - Failed to schedule cron job to check price at next interval:",
      error,
    );
    throw error;
  }
};

/**
 * Schedules a cron job to execute a take profit order for a fractionable asset on the next available trading day.
 */
export const alpacaCronJobScheduleTakeProfitOrderForFractionableAsset =
  async () => {
    try {
      const timeNowInNY = dayjs().tz(NEW_YORK_TIMEZONE);
      const { nextSessionOpen } =
        await getAlpacaNextAvailableTradingDay(timeNowInNY);

      if (!nextSessionOpen.isAfter(timeNowInNY)) {
        throw new Error(
          "alpacaCronJobScheduleTakeProfitOrderForFractionableAsset - Error nextSessionOpen is not after timeNowInNY",
        );
      }

      const utcDateTime = nextSessionOpen.utc();
      const minute = utcDateTime.minute();
      const hour = utcDateTime.hour();
      const dayOfMonth = utcDateTime.date();
      const month = utcDateTime.month() + 1; // month() returns 0-11, cron uses 1-12
      const cronExpression = `${minute} ${hour} ${dayOfMonth} ${month} *`;

      const client = new Client({ token: process.env.QSTASH_TOKEN ?? "" });
      await client.schedules.create({
        destination: `${ORDER_TS_BASE_URL}/api/alpaca/submittakeprofitorderforfractionableassets`,
        cron: cronExpression,
      });

      console.log(
        `alpacaCronJobScheduleTakeProfitOrderForFractionableAsset - Scheduled take profit order for ${nextSessionOpen.format(
          "YYYY-MM-DD HH:mm:ss z",
        )} NY time, which is ${utcDateTime.format("YYYY-MM-DD HH:mm:ss [UTC]")} UTC`,
      );
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          function: "alpacaCronJobScheduleTakeProfitOrderForFractionableAsset",
        },
      });
      console.error(
        "alpacaCronJobScheduleTakeProfitOrderForFractionableAsset - Error, failed to schedule cron job for take profit order",
        error,
      );
      throw error;
    }
  };
