import * as Sentry from "@sentry/nextjs";
import { Client } from "@upstash/qstash";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { type TradingViewAlert } from "../exchanges.types";
import { alpacaGetNextIntervalTime } from "./alpacaCronJob.helpers";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Schedules a cron job to check the price at the next defined interval.
 *
 * @param ticker - The stock ticker symbol.
 * @param price - Price of the TradingView alert.
 * @param intervalMinutes - The interval in minutes defined by the TradingView alert.
 */
export const alpacaSchedulePriceCheckAtNextIntervalCronJob = async ({
  ticker,
  closePrice,
  interval,
}: TradingViewAlert): Promise<void> => {
  if (!process.env.UPSTASH_QSTASH_TOKEN || !process.env.DOMAIN_BASE_URL) {
    throw new Error(
      "alpacaSchedulePriceCheckAtNextIntervalCronJob - environment variables are not defined",
    );
  }

  console.log(
    `Cron job start - alpacaSchedulePriceCheckAtNextIntervalCronJob - Scheduling cron job with ticker: ${ticker}, price: ${closePrice}, and interval: ${interval} minutes`,
  );

  // Get the next interval time
  const now = dayjs.utc();
  console.log(`Current UTC time: ${now.toISOString()}`);
  const nextTime = alpacaGetNextIntervalTime(now, parseInt(interval, 10));

  // Schedule the job using qstash
  const client = new Client({ token: process.env.UPSTASH_QSTASH_TOKEN });
  const jobData = { ticker, closePrice, interval };
  const delayInSeconds: number = nextTime.diff(now, "second");

  try {
    const response = await client.publish({
      topic: "schedule-job",
      destination: `${process.env.DOMAIN_BASE_URL}/compare-price`,
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
