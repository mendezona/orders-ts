import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { alpacaGetNextIntervalTime } from "./alpacaCronJob.helpers";

dayjs.extend(utc);
dayjs.extend(timezone);

describe("alpacaGetNextIntervalTime", () => {
  it("should return the next interval time within the trading day", () => {
    const now = dayjs.tz("2024-06-15T08:00:00", "America/New_York");
    const intervalMinutes = 240;
    const expectedNextInterval = dayjs
      .tz("2024-06-15T12:00:00", "America/New_York")
      .format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
    const nextInterval = alpacaGetNextIntervalTime(now, intervalMinutes).format(
      "YYYY-MM-DDTHH:mm:ss.SSS[Z]",
    );
    expect(nextInterval).toBe(expectedNextInterval);
  });
  it("should schedule for the first interval tomorrow at 4:15 AM if all times have passed today", () => {
    const now = dayjs.tz("2024-06-15T20:00:00", "America/New_York");
    const intervalMinutes = 240;
    const expectedNextInterval = dayjs
      .tz("2024-06-16T04:15:00", "America/New_York")
      .format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
    const nextInterval = alpacaGetNextIntervalTime(now, intervalMinutes).format(
      "YYYY-MM-DDTHH:mm:ss.SSS[Z]",
    );
    expect(nextInterval).toBe(expectedNextInterval);
  });
  it("should correctly handle intervals that fall exactly on the trading end time", () => {
    const now = dayjs.tz("2024-06-15T15:45:00", "America/New_York");
    const intervalMinutes = 240;
    const expectedNextInterval = dayjs
      .tz("2024-06-15T16:00:00", "America/New_York")
      .format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
    const nextInterval = alpacaGetNextIntervalTime(now, intervalMinutes).format(
      "YYYY-MM-DDTHH:mm:ss.SSS[Z]",
    );
    expect(nextInterval).toBe(expectedNextInterval);
  });
  it("should correctly handle intervals that start before the trading start time", () => {
    const now = dayjs.tz("2024-06-15T03:00:00", "America/New_York");
    const intervalMinutes = 240;
    const expectedNextInterval = dayjs
      .tz("2024-06-15T04:00:00", "America/New_York")
      .format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
    const nextInterval = alpacaGetNextIntervalTime(now, intervalMinutes).format(
      "YYYY-MM-DDTHH:mm:ss.SSS[Z]",
    );
    expect(nextInterval).toBe(expectedNextInterval);
  });
});
