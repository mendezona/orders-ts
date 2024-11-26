import Alpaca from "@alpacahq/alpaca-trade-api";
import * as Sentry from "@sentry/nextjs";
import { Client } from "@upstash/qstash";
import dayjs, { type Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { ORDER_TS_BASE_URL } from "~/actions/actions.constants";
import { alpacaGetCredentials } from "./alpacaAccount.utils";
import { type AlpacaCalendar } from "./alpacaApi.types";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Finds the next interval time for a cron job for extended hours trading.
 *
 * @param now - The current time of execution.
 * @param intervalMinutes - The interval in minutes defined by the TradingView alert.
 *
 * @returns A Dayjs object representing the next time to schedule the cron job.
 */
export const alpacaGetNextIntervalTime = async (
  now: Dayjs,
  intervalMinutes: number,
): Promise<Dayjs> => {
  const credentials = alpacaGetCredentials();

  const alpaca = new Alpaca({
    keyId: credentials.key,
    secretKey: credentials.secret,
    paper: credentials.paper,
  });

  // Get the trading calendar for the current date
  const calendar: AlpacaCalendar[] = (await alpaca.getCalendar({
    start: now.format("YYYY-MM-DDTHH:mm:ss[Z]"),
    end: now.format("YYYY-MM-DDTHH:mm:ss[Z]"),
  })) as AlpacaCalendar[];

  if (calendar[0] === undefined) {
    const errorMessage = "No trading calendar found for today.";
    console.log(errorMessage);
    Sentry.captureMessage(errorMessage);
    throw new Error(errorMessage);
  }

  const currentNYTime = dayjs().tz("America/New_York");
  const tradingDay: AlpacaCalendar = calendar[0];
  const tradingDate = dayjs(tradingDay.date).tz("America/New_York");

  const tradingStart: dayjs.Dayjs = tradingDate
    .set("hour", parseInt(tradingDay.session_open.slice(0, 2), 10))
    .set("minute", parseInt(tradingDay.session_open.slice(2, 4), 10))
    .set("second", 0)
    .set("millisecond", 0);

  const tradingEnd: dayjs.Dayjs = tradingDate
    .set("hour", parseInt(tradingDay.session_close.slice(0, 2), 10))
    .set("minute", parseInt(tradingDay.session_close.slice(2, 4), 10))
    .set("second", 0)
    .set("millisecond", 0);

  console.log(
    `Trading start: ${tradingStart.format(
      "HH:mm:ss",
    )}, Trading end: ${tradingEnd.format("HH:mm:ss")}`,
  );

  // Calculate the next interval time within the trading day
  for (
    let minutes = tradingStart.hour() * 60 + tradingStart.minute();
    minutes < tradingEnd.hour() * 60 + tradingEnd.minute();
    minutes += intervalMinutes
  ) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const intervalTime = currentNYTime
      .set("hour", hours)
      .set("minute", mins)
      .set("second", 0)
      .set("millisecond", 0);

    // If the interval time is after the current time, it is a valid next interval
    if (intervalTime.isAfter(currentNYTime)) {
      console.log(`Next interval time: ${intervalTime.toString()}`);
      return intervalTime;
    }
  }

  // If all times have passed today, schedule for the first interval of the next trading day at 4:15 AM
  const nextTradingDay = await alpacaGetNextAvailableTradingDay(now);
  const nextTime = nextTradingDay
    .set("hour", 4)
    .set("minute", 15)
    .set("second", 0)
    .set("millisecond", 0);

  console.log(
    "All times have passed today, scheduling for 4:15 AM on the next trading day on",
    nextTime.toString(),
  );
  return nextTime;
};

/**
 * Gets the next available trading day using the Alpaca JS SDK.
 *
 * @param date - The current date.
 *
 * @returns A Dayjs object representing the next available trading day.
 */
export const alpacaGetNextAvailableTradingDay = async (
  date: Dayjs,
): Promise<Dayjs> => {
  const credentials = alpacaGetCredentials();

  const alpaca: Alpaca = new Alpaca({
    keyId: credentials.key,
    secretKey: credentials.secret,
    paper: credentials.paper,
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const calendar = (await alpaca.getCalendar({
    start: date.format("YYYY-MM-DDTHH:mm:ss[Z]"),
    end: date.add(7, "day").format("YYYY-MM-DDTHH:mm:ss[Z]"),
  })) as AlpacaCalendar[];

  for (const day of calendar) {
    const tradingDay = dayjs(day.date).tz("America/New_York");
    if (tradingDay.isAfter(date, "day")) {
      console.log("Found next available trading day:", tradingDay);
      return tradingDay;
    }
  }

  const errorMessage =
    "Error - alpacaGetNextAvailableTradingDay - No trading days available in the next 7 days.";
  console.log(errorMessage);
  Sentry.captureMessage(errorMessage);
  throw new Error(errorMessage);
};

/**
 * Schedules a cron job to submit a fractionable take profit order at 3 AM NY time. Fractionable orders only allow time in force of day therefore this cron job is scheduled every trading day.
 */
export const scheduleFractionableTakeProfitOrderCronJob =
  async (): Promise<void> => {
    const now = dayjs().tz("America/New_York");
    const nextTradingDay = await alpacaGetNextAvailableTradingDay(now);

    // Get UTC hour for 3 AM NY time
    const nyOffset = now.utcOffset() / 60; // Convert minutes to hours
    const utcHour = (3 - nyOffset + 24) % 24; // Convert 3 AM NY to UTC, ensure positive hour
    const cronDate = nextTradingDay.format("DD MM *");
    const cronExpression = `0 ${utcHour} ${cronDate}`; // Run at 3:00 AM NY time (in UTC)

    console.log(
      `Scheduling fractionable take profit order for ${nextTradingDay
        .hour(3)
        .format("YYYY-MM-DD HH:mm:ss z")} NY time`,
    );

    const client = new Client({ token: process.env.QSTASH_TOKEN ?? "" });
    await client.schedules.create({
      destination: `${ORDER_TS_BASE_URL}/api/alpaca/submittakeprofitorderforfractionableassets`,
      cron: cronExpression,
    });
  };
