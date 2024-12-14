import Alpaca from "@alpacahq/alpaca-trade-api";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { ALPACA_LIVE_TRADING_ACCOUNT_NAME } from "./alpaca/alpaca.constants";
import * as alpacaAccountUtils from "./alpaca/alpacaAccount.utils";
import { LOCAL_TIMEZONE, NEW_YORK_TIMEZONE } from "./exchanges.constants";
import { getIsMarketOpen, logTimezonesOfCurrentTime } from "./exchanges.utils";

dayjs.extend(utc);
dayjs.extend(timezone);

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

jest.mock("./alpaca/alpacaAccount.utils", () => ({
  alpacaGetCredentials: jest.fn(),
}));

interface AlpacaClock {
  is_open: boolean;
  timestamp: string;
  next_open: string;
  next_close: string;
}

interface AlpacaInstance {
  getClock: jest.Mock<Promise<AlpacaClock>, []>;
}

jest.mock("@alpacahq/alpaca-trade-api", () => {
  const mockGetClock = jest.fn<Promise<AlpacaClock>, []>();
  return jest.fn().mockImplementation(
    (): AlpacaInstance => ({
      getClock: mockGetClock,
    }),
  );
});

describe("exchanges.utils.ts", () => {
  describe("getIsMarketOpen", () => {
    const mockAlpacaGetCredentials =
      alpacaAccountUtils.alpacaGetCredentials as unknown as jest.Mock<
        { key: string; secret: string; paper: boolean },
        []
      >;
    const MockedAlpaca = Alpaca as unknown as jest.Mock<AlpacaInstance>;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("returns true if market is open", async () => {
      mockAlpacaGetCredentials.mockReturnValue({
        key: "test_key",
        secret: "test_secret",
        paper: false,
      });
      const marketClockResponse: AlpacaClock = {
        is_open: true,
        timestamp: "2023-08-20T15:00:00Z",
        next_open: "2023-08-21T13:30:00Z",
        next_close: "2023-08-20T20:00:00Z",
      };
      MockedAlpaca.mockImplementation(
        (): AlpacaInstance => ({
          getClock: jest
            .fn<Promise<AlpacaClock>, []>()
            .mockResolvedValue(marketClockResponse),
        }),
      );
      const isOpen = await getIsMarketOpen(ALPACA_LIVE_TRADING_ACCOUNT_NAME);
      expect(isOpen).toBe(true);
    });

    it("returns false if market is closed", async () => {
      mockAlpacaGetCredentials.mockReturnValue({
        key: "test_key",
        secret: "test_secret",
        paper: false,
      });
      const marketClockResponse: AlpacaClock = {
        is_open: false,
        timestamp: "2023-08-20T15:00:00Z",
        next_open: "2023-08-21T13:30:00Z",
        next_close: "2023-08-20T20:00:00Z",
      };
      MockedAlpaca.mockImplementation(
        (): AlpacaInstance => ({
          getClock: jest
            .fn<Promise<AlpacaClock>, []>()
            .mockResolvedValue(marketClockResponse),
        }),
      );
      const isOpen = await getIsMarketOpen(ALPACA_LIVE_TRADING_ACCOUNT_NAME);
      expect(isOpen).toBe(false);
    });

    it("throws an error if Alpaca call fails", async () => {
      mockAlpacaGetCredentials.mockReturnValue({
        key: "test_key",
        secret: "test_secret",
        paper: false,
      });
      MockedAlpaca.mockImplementation(
        (): AlpacaInstance => ({
          getClock: jest
            .fn<Promise<AlpacaClock>, []>()
            .mockRejectedValue(new Error("Network Error")),
        }),
      );
      await expect(
        getIsMarketOpen(ALPACA_LIVE_TRADING_ACCOUNT_NAME),
      ).rejects.toThrow("Network Error");
    });

    it("validates the response against AlpacaClockSchema", async () => {
      mockAlpacaGetCredentials.mockReturnValue({
        key: "test_key",
        secret: "test_secret",
        paper: false,
      });
      const invalidClockResponse = {
        is_open: "not_a_boolean",
      };
      MockedAlpaca.mockImplementation(
        (): AlpacaInstance => ({
          getClock: jest
            .fn<Promise<AlpacaClock>, []>()
            .mockResolvedValue(invalidClockResponse as unknown as AlpacaClock),
        }),
      );
      await expect(
        getIsMarketOpen(ALPACA_LIVE_TRADING_ACCOUNT_NAME),
      ).rejects.toThrow();
    });
  });

  describe("logTimezonesOfCurrentTime", () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "log").mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("logs current time in New York and Local timezone", () => {
      const fixedDate = "2023-08-20T15:00:00Z";
      const now = dayjs.utc(fixedDate);
      jest.spyOn(dayjs, "utc").mockReturnValue(now);
      logTimezonesOfCurrentTime(NEW_YORK_TIMEZONE, LOCAL_TIMEZONE);
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      const calls = consoleSpy.mock.calls as unknown[][];
      const nyLogCall = calls[0];
      const localLogCall = calls[1];
      const nyMessage = nyLogCall?.[0] as string;
      const localMessage = localLogCall?.[0] as string;
      expect(nyMessage).toMatch(
        /Current time in New York: 2023-08-20 11:00:00/,
      );
      expect(localMessage).toMatch(
        /Current time in Local Timezone: 2023-08-20 \d{2}:00:00/,
      );
    });

    it("defaults to NEW_YORK_TIMEZONE and LOCAL_TIMEZONE if none are provided", () => {
      const fixedDate = "2023-08-20T15:00:00Z";
      const now = dayjs.utc(fixedDate);
      jest.spyOn(dayjs, "utc").mockReturnValue(now);
      logTimezonesOfCurrentTime();
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      const calls = consoleSpy.mock.calls as unknown[][];
      const firstCall = calls[0];
      const secondCall = calls[1];
      const firstMessage = firstCall?.[0] as string;
      const secondMessage = secondCall?.[0] as string;
      expect(firstMessage).toContain("Current time in New York:");
      expect(secondMessage).toContain("Current time in Local Timezone:");
    });
  });
});
