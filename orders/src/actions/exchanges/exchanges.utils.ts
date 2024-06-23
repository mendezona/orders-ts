import dayjs, { type Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { EXCHANGE_LOCAL_TIMEZONE } from "./exchanges.contants";
import { type GetBaseAndQuoteAssetsReturn } from "./exchanges.types";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Checks if the current time is outside of normal NASDAQ trading hours (9:30 AM to 4:00 PM ET).
 *
 * @returns - True if outside of normal trading hours, otherwise false.
 */
export const isOutsideNasdaqTradingHours = (): boolean => {
  const currentTimeET = dayjs().tz("America/New_York");
  const nasdaqOpenTime = currentTimeET
    .set("hour", 9)
    .set("minute", 30)
    .set("second", 0);
  const nasdaqCloseTime = currentTimeET
    .set("hour", 16)
    .set("minute", 0)
    .set("second", 0);

  if (
    currentTimeET.isBefore(nasdaqOpenTime) ||
    currentTimeET.isAfter(nasdaqCloseTime)
  ) {
    console.log("Outside normal NASDAQ trading hours");
    return true;
  }
  console.log("Inside normal NASDAQ trading hours");
  return false;
};

/**
 * Logs and returns the current time in New York and a specified local timezone.
 *
 * @param localTimezone - The local timezone for conversion.
 *
 * @returns - Current time in New York and the specified local timezone, formatted as "YYYY-MM-DD HH:mm:ss".
 */
export const logTimesInNewYorkAndLocalTimezone = (
  localTimezone: string = EXCHANGE_LOCAL_TIMEZONE,
): [string, string] => {
  const timeZoneNewYork = "America/New_York";
  const nowUTC = dayjs.utc();
  const timeInNewYork = nowUTC
    .tz(timeZoneNewYork)
    .format("YYYY-MM-DD HH:mm:ss");
  const timeInLocalTimezone = nowUTC
    .tz(localTimezone)
    .format("YYYY-MM-DD HH:mm:ss");

  console.log(`Current time in New York: ${timeInNewYork}`);
  console.log(`Current time in Local Timezone: ${timeInLocalTimezone}`);

  return [timeInNewYork, timeInLocalTimezone];
};

/**
 * Pauses execution for a specified duration.
 *
 * @param milliseconds - Duration to wait in milliseconds.
 *
 * @returns - A promise that resolves after the delay.
 */
export const wait = (milliseconds: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

/**
 * Removes hyphens from a given pair symbol.
 *
 * @param pairSymbol - The symbol from which to remove hyphens (e.g., "BTC-USDT").
 *
 * @returns The symbol without hyphens.
 */
export const removeHyphensFromPairSymbol = (pairSymbol: string): string => {
  return pairSymbol.replace(/-/g, "");
};

/**
 * Find base and quote assets in a trade pair symbol.
 * For example, "AAPL-BTC" would be "AAPL" as the base currency and "BTC" as the quote currency.
 *
 * @param pairSymbol - Pair symbol formatted with a hyphen, e.g., "BASE-QUOTE".
 *
 * @returns A tuple of strings, Base currency and Quote currency.
 */
export const getBaseAndQuoteAssets = (
  pairSymbol: string,
): GetBaseAndQuoteAssetsReturn => {
  if (!pairSymbol.includes("-")) {
    throw new Error("Invalid symbol format. Expected format: 'BASE-QUOTE'");
  }

  const parts = pairSymbol.split("-");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid symbol format: '${pairSymbol}'. Expected format: 'BASE-QUOTE'`,
    );
  }

  return {
    baseAsset: parts[0].toUpperCase(),
    quoteAsset: parts[1].toUpperCase(),
  };
};

/**
 * Finds the next interval time for a cron job for a 24/7 market.
 *
 * @param now - The current time of execution.
 * @param intervalMinutes - The interval in minutes defined by the TradingView alert.
 *
 * @returns A Dayjs object representing the next time to schedule the cron job.
 */
export const getNextIntervalTimeFor24Hour7DayMarket = (
  now: Dayjs,
  intervalMinutes: number,
): Dayjs => {
  // Total minutes in a day (1440 minutes)
  const totalMinutesInDay = 24 * 60;

  // Calculate the next interval time within the day
  for (
    let minutes = 0;
    minutes < totalMinutesInDay;
    minutes += intervalMinutes
  ) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const intervalTime = now
      .set("hour", hours)
      .set("minute", mins)
      .set("second", 0)
      .set("millisecond", 0);

    // If the interval time is after the current time, it is a valid next interval
    if (intervalTime.isAfter(now)) {
      console.log(
        `getNextIntervalTimeFor24Hour7DayMarket - Next interval time: ${intervalTime.toString()}`,
      );
      return intervalTime;
    }
  }

  // If all times have passed today, schedule for the first interval tomorrow
  const nextTime = now
    .set("hour", 0)
    .set("minute", 0)
    .set("second", 0)
    .set("millisecond", 0)
    .add(1, "day");
  console.log(
    "getNextIntervalTimeFor24Hour7DayMarket -All times have passed today, scheduling for the first interval tomorrow",
  );
  return nextTime;
};
