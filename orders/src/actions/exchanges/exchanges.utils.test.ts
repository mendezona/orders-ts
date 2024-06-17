import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { logTimesInNewYorkAndLocalTimezone } from "./exchanges.utils";

dayjs.extend(utc);
dayjs.extend(timezone);

describe("logTimesInNewYorkAndLocalTimezone", () => {
  const originalConsoleLog = console.log;
  beforeEach(() => {
    console.log = jest.fn();
  });
  afterEach(() => {
    console.log = originalConsoleLog;
  });
  it("should return the correct times for New York and the given local timezone", () => {
    const localTimezone = "Europe/Berlin";
    const [timeInNewYork, timeInLocalTimezone] =
      logTimesInNewYorkAndLocalTimezone(localTimezone);
    expect(timeInNewYork).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(timeInLocalTimezone).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    );
  });
  it("should log the correct times for New York and the given local timezone", () => {
    const localTimezone = "Europe/Berlin";
    logTimesInNewYorkAndLocalTimezone(localTimezone);
    expect(console.log).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Current time in New York:"),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Current time in Local Timezone:"),
    );
  });
});
