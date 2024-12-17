import * as Sentry from "@sentry/nextjs";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { ZodError } from "zod";
import { NEW_YORK_TIMEZONE } from "../exchanges.constants";
import { getAlpacaCredentials } from "./alpacaAccount.utils";
import {
  getAlpacaNextAvailableTradingDay,
  getAlpacaNextIntervalTime,
} from "./alpacaCronJob.helpers";

dayjs.extend(utc);
dayjs.extend(timezone);

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));
jest.mock("./alpacaAccount.utils", () => ({
  getAlpacaCredentials: jest.fn(),
}));

const mockGetCalendar = jest.fn();

jest.mock("@alpacahq/alpaca-trade-api", () => {
  return jest.fn().mockImplementation(() => ({
    getCalendar: mockGetCalendar,
  }));
});

const mockGetAlpacaCredentials = getAlpacaCredentials as jest.Mock;

describe("alpacaCronJob.helpers.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetAlpacaCredentials.mockReturnValue({
      key: "test_key",
      secret: "test_secret",
      paper: true,
    });
  });

  describe("getAlpacaNextAvailableTradingDay", () => {
    it("returns the next trading day and session open if found", async () => {
      const now = dayjs("2023-08-10T09:30:00Z").tz(NEW_YORK_TIMEZONE);
      const mockResponse = [
        {
          date: "2023-08-11",
          session_open: "0930",
          session_close: "1600",
        },
      ];
      mockGetCalendar.mockResolvedValue(mockResponse);

      const { nextTradingDay, nextSessionOpen } =
        await getAlpacaNextAvailableTradingDay(now);
      expect(nextTradingDay.format("YYYY-MM-DD")).toBe("2023-08-11");
      expect(nextSessionOpen.format("YYYY-MM-DD HH:mm")).toBe(
        "2023-08-11 09:30",
      );
    });

    it("throws error if no trading days found", async () => {
      const now = dayjs("2023-08-10T09:30:00Z").tz(NEW_YORK_TIMEZONE);
      mockGetCalendar.mockResolvedValue([]);
      await expect(getAlpacaNextAvailableTradingDay(now)).rejects.toThrow(
        "getAlpacaNextAvailableTradingDay - No available trading days found in the next 7 days",
      );
      expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
        tags: { function: "getAlpacaNextAvailableTradingDay" },
      });
    });

    it("throws ZodError if the response is invalid", async () => {
      const now = dayjs("2023-08-10T09:30:00Z").tz(NEW_YORK_TIMEZONE);
      // Missing required fields: session_open, session_close
      mockGetCalendar.mockResolvedValue([
        {
          date: "2023-08-11",
          // no session_open, session_close
        },
      ]);
      await expect(getAlpacaNextAvailableTradingDay(now)).rejects.toThrow(
        ZodError,
      );
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(ZodError),
        {
          tags: { function: "getAlpacaNextAvailableTradingDay" },
        },
      );
    });

    it("throws error if getCalendar fails", async () => {
      const now = dayjs("2023-08-10T09:30:00Z").tz(NEW_YORK_TIMEZONE);
      const error = new Error("Network Error");
      mockGetCalendar.mockRejectedValue(error);
      await expect(getAlpacaNextAvailableTradingDay(now)).rejects.toThrow(
        "Network Error",
      );
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { function: "getAlpacaNextAvailableTradingDay" },
      });
    });
  });

  describe("getAlpacaNextIntervalTime", () => {
    it("throws ZodError if response is invalid", async () => {
      const now = dayjs("2023-08-10T09:30:00Z").tz(NEW_YORK_TIMEZONE);
      mockGetCalendar.mockResolvedValue([
        {
          date: "2023-08-10",
        },
      ]);
      await expect(getAlpacaNextIntervalTime(now, 30)).rejects.toThrow(
        ZodError,
      );
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(ZodError),
        {
          tags: { function: "getAlpacaNextIntervalTime" },
        },
      );
    });

    it("throws error if getCalendar fails", async () => {
      const now = dayjs("2023-08-10T09:30:00Z").tz(NEW_YORK_TIMEZONE);
      const error = new Error("Network Error");
      mockGetCalendar.mockRejectedValue(error);
      await expect(getAlpacaNextIntervalTime(now, 30)).rejects.toThrow(
        "Network Error",
      );
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { function: "getAlpacaNextIntervalTime" },
      });
    });
  });
});
