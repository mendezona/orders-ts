/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Gets the start time of the current trading day in UTC.
 *
 * @param includePremarket - If true, includes premarket hours starting at 4:00 AM ET. Otherwise, starts at 9:30 AM ET.

 * @returns - The start time of the current trading day in UTC, formatted as an ISO string.
 *
 */
export const getStartOfCurrentTradingDay = (
  includePremarket = false,
): string => {
  const timeZone = "America/New_York";
  const startOfTodayNYC = dayjs().tz(timeZone).startOf("day");
  const startOfTradingDayNYC = includePremarket
    ? startOfTodayNYC.add(4, "hours") // 4:00 AM for premarket
    : startOfTodayNYC.add(9, "hours").add(30, "minutes"); // 9:30 AM for regular market
  return startOfTradingDayNYC.utc().format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
};

export default getStartOfCurrentTradingDay;
