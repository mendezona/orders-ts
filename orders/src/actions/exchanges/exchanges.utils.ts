import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { EXCHANGE_LOCAL_TIMEZONE } from "./exchanges.contants";

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
