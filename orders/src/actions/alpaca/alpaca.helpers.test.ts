import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import getStartOfCurrentTradingDay from "./alpaca.helpers";

dayjs.extend(timezone);

describe("getStartOfCurrentTradingDay", () => {
  it("should return the start time of the regular trading day in UTC", () => {
    const result = getStartOfCurrentTradingDay();
    const expected = dayjs()
      .tz("America/New_York")
      .startOf("day")
      .add(9, "hours")
      .add(30, "minutes")
      .utc()
      .format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
    expect(result).toBe(expected);
  });

  it("should return the start time of the premarket trading day in UTC", () => {
    const result = getStartOfCurrentTradingDay(true);
    const expected = dayjs()
      .tz("America/New_York")
      .startOf("day")
      .add(4, "hours")
      .utc()
      .format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
    expect(result).toBe(expected);
  });
});
