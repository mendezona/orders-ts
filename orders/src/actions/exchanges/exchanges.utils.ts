import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { EXCHANGE_LOCAL_TIMEZONE } from "./exchanges.contants";

dayjs.extend(utc);
dayjs.extend(timezone);

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
