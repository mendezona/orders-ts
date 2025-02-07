import Alpaca from "@alpacahq/alpaca-trade-api";
import * as Sentry from "@sentry/nextjs";
import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { ZodError } from "zod";
import { NEW_YORK_TIMEZONE } from "../exchanges.constants";
import { getAlpacaCredentials } from "./alpacaAccount.utils";
import { AlpacaCalendarSchema, type AlpacaDate } from "./alpacaApi.types";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

/**
 * Gets the next available trading day using the Alpaca JS SDK.
 *
 * @param date - The current date.
 *
 * @returns A Dayjs object representing the next available trading day.
 */
export const getAlpacaNextAvailableTradingDay = async (date: Dayjs) => {
  try {
    const credentials = getAlpacaCredentials();
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    const response: unknown = await alpaca.getCalendar({
      start: date.format("YYYY-MM-DDTHH:mm:ss[Z]"),
      end: date.add(7, "day").format("YYYY-MM-DDTHH:mm:ss[Z]"),
    });
    const parsedResponse = AlpacaCalendarSchema.parse(response);

    for (const day of parsedResponse) {
      const nextTradingDay = dayjs(day.date);

      if (nextTradingDay.isAfter(date, "day")) {
        const nextSessionOpen = dayjs(
          `${day.date} ${day.session_open}`,
          "YYYY-MM-DD HHmm",
        );

        console.log(
          "getAlpacaNextAvailableTradingDay - Found next available trading day:",
          nextTradingDay.format("DD-MM-YYYY"),
        );
        return { nextTradingDay, nextSessionOpen };
      }
    }

    throw new Error(
      "getAlpacaNextAvailableTradingDay - No available trading days found in the next 7 days",
    );
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        function: "getAlpacaNextAvailableTradingDay",
      },
    });
    if (error instanceof ZodError) {
      console.error(
        "getAlpacaNextAvailableTradingDay - Error validation failed with ZodError:",
        error.errors,
      );
    } else {
      console.log(
        "getAlpacaNextAvailableTradingDay - Error fetching next available trading day:",
        error,
      );
    }
    throw error;
  }
};

/**
 * Finds the next interval time for a cron job for extended hours trading.
 *
 * @param now - The current time of execution.
 * @param intervalMinutes - The interval in minutes defined by the TradingView alert.
 *
 * @returns A Dayjs object representing the next time to schedule the cron job.
 */
export const getAlpacaNextIntervalTime = async (
  now: Dayjs,
  intervalMinutes: number,
) => {
  try {
    console.log("getAlpacaNextIntervalTime - Getting next interval time");
    console.log("getAlpacaNextIntervalTime - Now:", now.toISOString());

    const credentials = getAlpacaCredentials();
    const alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    const response: unknown = await alpaca.getCalendar({
      start: now.format("YYYY-MM-DDTHH:mm:ss[Z]"),
      end: now.format("YYYY-MM-DDTHH:mm:ss[Z]"),
    });
    const parsedResponse = AlpacaCalendarSchema.parse(response);

    if (parsedResponse[0] === undefined) {
      const errorMessage =
        "getAlpacaNextIntervalTime - Error no trading calendar found for today.";
      console.log(errorMessage);
      throw new Error(errorMessage);
    }

    const tradingDay: AlpacaDate = parsedResponse[0];
    const tradingDate = dayjs(tradingDay.date).tz(NEW_YORK_TIMEZONE);
    const currentNYTime = dayjs().tz(NEW_YORK_TIMEZONE);

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
      `getAlpacaNextIntervalTime - Trading start: ${tradingStart.format(
        "HH:mm:ss",
      )}, Trading end: ${tradingEnd.format("HH:mm:ss")}`,
    );

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
        console.log(
          `getAlpacaNextIntervalTime - Next interval time: ${intervalTime.toISOString()}`,
        );
        return intervalTime;
      }
    }

    // If all times have passed today, schedule for the first interval of the next trading day at session open
    const { nextSessionOpen } = await getAlpacaNextAvailableTradingDay(now);

    console.log(
      `getAlpacaNextIntervalTime - No more trading intervals available today. Scheduling for tomorrow's market open at: ${nextSessionOpen.format("YYYY-MM-DD HH:mm:ss")}`,
    );
    return nextSessionOpen;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        function: "getAlpacaNextIntervalTime",
      },
    });
    if (error instanceof ZodError) {
      console.error(
        "getAlpacaNextIntervalTime - Error validation failed with ZodError:",
        error.errors,
      );
    } else {
      console.log(
        "getAlpacaNextIntervalTime - Error fetching next interval time:",
        error,
      );
    }
    throw error;
  }
};
