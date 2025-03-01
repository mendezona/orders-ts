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
 * @param useExtendedHours - Whether to use extended trading hours or regular market hours.
 *
 * @returns A Dayjs object representing the next available trading day.
 */
export const getAlpacaNextAvailableTradingDay = async (
  date: Dayjs,
  useExtendedHours = true,
) => {
  console.log(
    "getAlpacaNextAvailableTradingDay - Getting next available trading day",
  );
  console.log(
    `getAlpacaNextAvailableTradingDay - Using ${useExtendedHours ? "extended" : "regular"} trading hours`,
  );

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
        // Select appropriate time format based on useExtendedHours
        let timeStr: string;
        let formatStr: string;

        if (useExtendedHours) {
          // Extended hours format: "HHMM"
          if (!day.session_open) {
            console.log(
              "getAlpacaNextAvailableTradingDay - Extended market hours not available for date:",
              day.date,
            );
            continue; // Skip this day if extended hours aren't available
          }
          timeStr = day.session_open;
          formatStr = "YYYY-MM-DD HHmm";
        } else {
          // Regular market hours format: "HH:MM"
          if (!day.open) {
            console.log(
              "getAlpacaNextAvailableTradingDay - Regular market hours not available for date:",
              day.date,
            );
            continue; // Skip this day if regular hours aren't available
          }
          timeStr = day.open.replace(":", "");
          formatStr = "YYYY-MM-DD HHmm";
        }

        const nextSessionOpen = dayjs(`${day.date} ${timeStr}`, formatStr);

        console.log(
          `getAlpacaNextAvailableTradingDay - Found next available trading day (${useExtendedHours ? "extended" : "regular"} hours):`,
          nextTradingDay.format("DD-MM-YYYY"),
          "opening at",
          nextSessionOpen.format("HH:mm"),
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
 * Finds the next interval time for a cron job for trading.
 *
 * @param now - The current time of execution.
 * @param intervalMinutes - The interval in minutes defined by the TradingView alert.
 * @param useExtendedHours - Whether to use extended trading hours or regular market hours.
 *
 * @returns A Dayjs object representing the next time to schedule the cron job.
 */
export const getAlpacaNextIntervalTime = async (
  now: Dayjs,
  intervalMinutes: number,
  useExtendedHours = true,
) => {
  try {
    console.log("getAlpacaNextIntervalTime - Getting next interval time");
    console.log("getAlpacaNextIntervalTime - Now:", now.toISOString());
    console.log(
      `getAlpacaNextIntervalTime - Using ${useExtendedHours ? "extended" : "regular"} trading hours`,
    );

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

    // Determine trading start and end times based on useExtendedHours flag
    let startTimeStr: string;
    let endTimeStr: string;

    if (useExtendedHours) {
      // Extended hours - use session_open and session_close
      if (!tradingDay.session_open || !tradingDay.session_close) {
        const errorMessage =
          "getAlpacaNextIntervalTime - Extended market hours (session_open/session_close) not available";
        console.log(errorMessage);
        throw new Error(errorMessage);
      }
      startTimeStr = tradingDay.session_open;
      endTimeStr = tradingDay.session_close;
    } else {
      // Regular market hours - use open and close
      if (!tradingDay.open || !tradingDay.close) {
        const errorMessage =
          "getAlpacaNextIntervalTime - Regular market hours (open/close) not available";
        console.log(errorMessage);
        throw new Error(errorMessage);
      }
      startTimeStr = tradingDay.open;
      endTimeStr = tradingDay.close;
    }

    // Parse hours and minutes differently based on the format
    let startHours: number,
      startMinutes: number,
      endHours: number,
      endMinutes: number;

    if (useExtendedHours) {
      // Extended hours format: "HHMM"
      startHours = parseInt(startTimeStr.slice(0, 2), 10);
      startMinutes = parseInt(startTimeStr.slice(2, 4), 10);
      endHours = parseInt(endTimeStr.slice(0, 2), 10);
      endMinutes = parseInt(endTimeStr.slice(2, 4), 10);
    } else {
      // Regular hours format: "HH:MM"
      const [startHoursStr, startMinutesStr] = startTimeStr.split(":");
      const [endHoursStr, endMinutesStr] = endTimeStr.split(":");

      if (
        !startHoursStr ||
        !startMinutesStr ||
        !endHoursStr ||
        !endMinutesStr
      ) {
        const errorMessage =
          "getAlpacaNextIntervalTime - Error parsing trading hours";
        console.log(errorMessage);
        throw new Error(errorMessage);
      }

      startHours = parseInt(startHoursStr, 10);
      startMinutes = parseInt(startMinutesStr, 10);
      endHours = parseInt(endHoursStr, 10);
      endMinutes = parseInt(endMinutesStr, 10);
    }

    const tradingStart: dayjs.Dayjs = tradingDate
      .set("hour", startHours)
      .set("minute", startMinutes)
      .set("second", 0)
      .set("millisecond", 0);

    const tradingEnd: dayjs.Dayjs = tradingDate
      .set("hour", endHours)
      .set("minute", endMinutes)
      .set("second", 0)
      .set("millisecond", 0);

    console.log(
      `getAlpacaNextIntervalTime - Trading start: ${tradingStart.format(
        "HH:mm:ss",
      )}, Trading end: ${tradingEnd.format("HH:mm:ss")} (${useExtendedHours ? "extended" : "regular"} hours)`,
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
    const { nextSessionOpen } = await getAlpacaNextAvailableTradingDay(
      now,
      useExtendedHours,
    );

    console.log(
      `getAlpacaNextIntervalTime - No more trading intervals available today. Scheduling for tomorrow's market ${useExtendedHours ? "extended" : "regular"} open at: ${nextSessionOpen.format("YYYY-MM-DD HH:mm:ss")}`,
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
