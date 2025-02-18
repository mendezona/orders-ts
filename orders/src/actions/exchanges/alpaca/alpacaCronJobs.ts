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
  console.log(
    `alpacaCronJobSchedulePriceCheckAtNextInterval - Scheduling cron job with ticker: ${tradingViewSymbol}, price: ${tradingViewPrice}, and interval: ${tradingViewInterval} minutes`,
  );

  try {
    if (!process.env.QSTASH_URL || !process.env.QSTASH_TOKEN) {
      const errorMessage =
        "alpacaCronJobSchedulePriceCheckAtNextInterval - QSTASH environment variables are not defined";
      console.log(errorMessage);
      throw new Error(errorMessage);
    }

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

    console.log(
      `alpacaCronJobSchedulePriceCheckAtNextInterval - Delay in seconds: ${delayInSeconds}`,
    );

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
 * Schedules a one-off job to execute a take profit order for a fractionable asset on the next available trading day.
 */
export const alpacaCronJobScheduleTakeProfitOrderForFractionableAsset =
  async () => {
    console.log(
      "alpacaCronJobScheduleTakeProfitOrderForFractionableAsset - Scheduling one-off job",
    );

    try {
      const timeNowInNY = dayjs().tz(NEW_YORK_TIMEZONE);
      const { nextSessionOpen } =
        await getAlpacaNextAvailableTradingDay(timeNowInNY);

      console.log(
        "alpacaCronJobScheduleTakeProfitOrderForFractionableAsset - timeNowInNY",
        timeNowInNY.toISOString(),
      );
      console.log(
        "alpacaCronJobScheduleTakeProfitOrderForFractionableAsset - nextSessionOpen",
        nextSessionOpen.toISOString(),
      );

      if (!nextSessionOpen.isAfter(timeNowInNY)) {
        throw new Error(
          "alpacaCronJobScheduleTakeProfitOrderForFractionableAsset - Error: nextSessionOpen is not after timeNowInNY",
        );
      }

      // Convert nextSessionOpen to UTC and compute the delay
      const utcNextSessionOpen = nextSessionOpen.utc();
      const nowUTC = dayjs().utc();
      const delayInSeconds = utcNextSessionOpen.diff(nowUTC, "second");

      console.log(
        `alpacaCronJobScheduleTakeProfitOrderForFractionableAsset - Scheduling one-off job to run in ${delayInSeconds} seconds at ${utcNextSessionOpen.format()} UTC`,
      );

      const client = new Client({ token: process.env.QSTASH_TOKEN ?? "" });
      await client.publish({
        url: `${ORDER_TS_BASE_URL}/api/alpaca/submittakeprofitorderforfractionableassets`,
        delay: delayInSeconds, // delay is in seconds
      });

      console.log(
        `alpacaCronJobScheduleTakeProfitOrderForFractionableAsset - Scheduled take profit order for ${nextSessionOpen.format(
          "YYYY-MM-DD HH:mm:ss z",
        )} NY time, which is ${utcNextSessionOpen.format("YYYY-MM-DD HH:mm:ss [UTC]")} UTC`,
      );
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          function: "alpacaCronJobScheduleTakeProfitOrderForFractionableAsset",
        },
      });
      console.error(
        "alpacaCronJobScheduleTakeProfitOrderForFractionableAsset - Error, failed to schedule one-off job for take profit order",
        error,
      );
      throw error;
    }
  };
