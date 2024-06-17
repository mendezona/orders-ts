import dayjs, { type Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

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
export const alpacaGetNextIntervalTime = (
  now: Dayjs,
  intervalMinutes: number,
): Dayjs => {
  const tradingStart = 4 * 60; // 4:00 AM in minutes
  const tradingEnd = 19 * 60 + 45; // 7:45 PM in minutes

  console.log(
    `Trading start: ${tradingStart} minutes, Trading end: ${tradingEnd} minutes`,
  );

  // Calculate the next interval time within the trading day
  for (
    let minutes = tradingStart;
    minutes < tradingEnd;
    minutes += intervalMinutes
  ) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const intervalTime = now
      .tz("America/New_York")
      .set("hour", hours)
      .set("minute", mins)
      .set("second", 0)
      .set("millisecond", 0);

    // If the interval time is after the current time, it is a valid next interval
    if (intervalTime.isAfter(now)) {
      console.log(`Next interval time: ${intervalTime.toString()}`);
      return intervalTime;
    }
  }

  // If all times have passed today, schedule for the first interval tomorrow at 4:15 AM
  const nextTime = now
    .tz("America/New_York")
    .set("hour", 4)
    .set("minute", 15)
    .set("second", 0)
    .set("millisecond", 0)
    .add(1, "day");
  console.log("All times have passed today, scheduling for 4:15 AM tomorrow");
  return nextTime;
};
