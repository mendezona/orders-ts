import * as Sentry from "@sentry/nextjs";
import { Client } from "@upstash/qstash";
import dayjs from "dayjs";
import { ORDER_TS_BASE_URL } from "~/actions/actions.constants";
import { NEW_YORK_TIMEZONE } from "../exchanges.constants";
import {
  getAlpacaNextAvailableTradingDay,
  getAlpacaNextIntervalTime,
} from "./alpacaCronJob.helpers";
import {
  alpacaCronJobSchedulePriceCheckAtNextInterval,
  alpacaCronJobScheduleTakeProfitOrderForFractionableAsset,
} from "./alpacaCronJobs";

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));
jest.mock("@upstash/qstash");
jest.mock("./alpacaCronJob.helpers", () => ({
  getAlpacaNextAvailableTradingDay: jest.fn(),
  getAlpacaNextIntervalTime: jest.fn(),
}));

const mockCaptureException = Sentry.captureException as jest.Mock;
const mockGetAlpacaNextAvailableTradingDay =
  getAlpacaNextAvailableTradingDay as jest.Mock;
const mockGetAlpacaNextIntervalTime = getAlpacaNextIntervalTime as jest.Mock;
const mockClientPublish = jest.fn();
const mockClientSchedulesCreate = jest.fn();

(Client as jest.Mock).mockImplementation(() => ({
  publish: mockClientPublish,
  schedules: {
    create: mockClientSchedulesCreate,
  },
}));

describe("alpacaCronJobs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.QSTASH_URL = "https://qstash.upstash.io";
    process.env.QSTASH_TOKEN = "test_token";
  });

  describe("alpacaCronJobSchedulePriceCheckAtNextInterval", () => {
    it("throws error if QSTASH env vars are not defined", async () => {
      delete process.env.QSTASH_URL;
      await expect(
        alpacaCronJobSchedulePriceCheckAtNextInterval({
          tradingViewSymbol: "AAPL",
          tradingViewPrice: "150",
          tradingViewInterval: "30",
          buyAlert: true,
        }),
      ).rejects.toThrow("QSTASH environment variables are not defined");
    });

    it("schedules a job if all is well", async () => {
      jest.useFakeTimers();
      const now = dayjs.utc("2023-08-10T10:00:00Z");
      jest.setSystemTime(now.toDate());

      const nextIntervalTime = now.add(10, "minute");
      mockGetAlpacaNextIntervalTime.mockResolvedValue(nextIntervalTime);
      mockClientPublish.mockResolvedValue({ id: "fake_job_id" });

      await alpacaCronJobSchedulePriceCheckAtNextInterval({
        tradingViewSymbol: "AAPL",
        tradingViewPrice: "150",
        tradingViewInterval: "30",
        buyAlert: true,
      });

      expect(mockClientPublish).toHaveBeenCalledWith({
        url: `${ORDER_TS_BASE_URL}/api/alpaca/checkpriceatnextinterval`,
        delay: 600, // exactly 10 minutes in seconds
        body: JSON.stringify({ tradingViewSymbol: "AAPL", buyAlert: true }),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        retries: 1,
      });

      jest.useRealTimers();
    });

    it("captures error and re-throws if something fails", async () => {
      const error = new Error("Some error");
      mockGetAlpacaNextIntervalTime.mockRejectedValue(error);
      await expect(
        alpacaCronJobSchedulePriceCheckAtNextInterval({
          tradingViewSymbol: "AAPL",
          tradingViewPrice: "150",
          tradingViewInterval: "30",
          buyAlert: true,
        }),
      ).rejects.toThrow("Some error");
      expect(mockCaptureException).toHaveBeenCalledWith(error);
    });
  });

  describe("alpacaCronJobScheduleTakeProfitOrderForFractionableAsset", () => {
    it("throws error if nextSessionOpen is not after timeNowInNY", async () => {
      const timeNowInNY = dayjs("2023-08-10T09:30:00Z").tz(NEW_YORK_TIMEZONE);
      mockGetAlpacaNextAvailableTradingDay.mockResolvedValue({
        nextSessionOpen: timeNowInNY,
      });
      await expect(
        alpacaCronJobScheduleTakeProfitOrderForFractionableAsset(),
      ).rejects.toThrow(
        "alpacaCronJobScheduleTakeProfitOrderForFractionableAsset - Error nextSessionOpen is not after timeNowInNY",
      );
      expect(mockCaptureException).toHaveBeenCalled();
    });

    it("schedules cron job correctly for the next available trading day", async () => {
      const timeNowInNY = dayjs("2023-08-10T09:30:00Z").tz(NEW_YORK_TIMEZONE);
      const nextSessionOpen = timeNowInNY.add(1, "day").hour(9).minute(30);
      jest.useFakeTimers();
      jest.setSystemTime(timeNowInNY.toDate());
      mockGetAlpacaNextAvailableTradingDay.mockResolvedValue({
        nextSessionOpen,
      });
      await alpacaCronJobScheduleTakeProfitOrderForFractionableAsset();
      const utcDateTime = nextSessionOpen.utc();
      const cronExpression = `${utcDateTime.minute()} ${utcDateTime.hour()} ${utcDateTime.date()} ${
        utcDateTime.month() + 1
      } *`;
      expect(mockClientSchedulesCreate).toHaveBeenCalledWith({
        destination: `${ORDER_TS_BASE_URL}/api/alpaca/submittakeprofitorderforfractionableassets`,
        cron: cronExpression,
      });
      jest.useRealTimers();
    });

    it("captures error and re-throws if something fails", async () => {
      const error = new Error("Network Error");
      mockGetAlpacaNextAvailableTradingDay.mockRejectedValue(error);
      await expect(
        alpacaCronJobScheduleTakeProfitOrderForFractionableAsset(),
      ).rejects.toThrow("Network Error");
      expect(mockCaptureException).toHaveBeenCalledWith(error);
    });
  });
});
