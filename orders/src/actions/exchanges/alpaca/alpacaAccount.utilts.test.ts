import Alpaca from "@alpacahq/alpaca-trade-api";
import * as Sentry from "@sentry/nextjs";
import { ZodError } from "zod";
import { getLatestTaxAmountCurrentFinancialYear } from "~/server/queries";
import {
  ALPACA_ACCOUNTS,
  ALPACA_LIVE_TRADING_ACCOUNT_NAME,
} from "./alpaca.constants";
import {
  getAlpacaAccountBalance,
  getAlpacaCredentials,
} from "./alpacaAccount.utils";

type AlpacaAccountInfo = {
  endpoint: string;
  key: string;
  secret: string;
  paper: boolean;
};

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));
jest.mock("~/server/queries", () => ({
  getLatestTaxAmountCurrentFinancialYear: jest.fn(),
}));
jest.mock("@alpacahq/alpaca-trade-api", () => {
  return jest.fn().mockImplementation(() => ({
    getAccount: jest.fn(),
  }));
});

describe("alpacaAccount.utils.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAlpacaCredentials", () => {
    it("returns credentials for the provided account", () => {
      const accounts = ALPACA_ACCOUNTS as Record<string, AlpacaAccountInfo>;
      accounts[ALPACA_LIVE_TRADING_ACCOUNT_NAME] = {
        endpoint: "https://api.alpaca.markets",
        key: "live_key",
        secret: "live_secret",
        paper: false,
      };

      const creds = getAlpacaCredentials(
        ALPACA_LIVE_TRADING_ACCOUNT_NAME,
        false,
      );
      expect(creds).toEqual({
        endpoint: "https://api.alpaca.markets",
        key: "live_key",
        secret: "live_secret",
        paper: false,
      });
    });
  });

  describe("getAlpacaAccountBalance", () => {
    const mockAccount = {
      id: "some_id",
      account_number: "AC12345678",
      equity: "10000",
      cash: "5000",
    };
    const mockGetAccount = jest.fn();
    const mockGetLatestTaxAmount =
      getLatestTaxAmountCurrentFinancialYear as jest.Mock;

    beforeEach(() => {
      (Alpaca as jest.Mock).mockImplementation(() => ({
        getAccount: mockGetAccount,
      }));
      mockGetLatestTaxAmount.mockResolvedValue("0");
      const accounts = ALPACA_ACCOUNTS as Record<string, AlpacaAccountInfo>;
      accounts[ALPACA_LIVE_TRADING_ACCOUNT_NAME] = {
        endpoint: "https://api.alpaca.markets",
        key: "live_key",
        secret: "live_secret",
        paper: false,
      };
    });

    it("returns the account balance with all required fields", async () => {
      mockGetAccount.mockResolvedValue({
        ...mockAccount,
        id: "123e4567-e89b-12d3-a456-426614174000",
      });
      const result = await getAlpacaAccountBalance(
        ALPACA_LIVE_TRADING_ACCOUNT_NAME,
        true,
      );
      expect(result.account.equity).toBe("10000");
      expect(result.accountCash.toString()).toBe("5000");
      expect(result.accountEquity.toString()).toBe("10000");
    });

    it("throws ZodError if the account is missing required fields", async () => {
      mockGetAccount.mockResolvedValue({ equity: "10000", cash: "5000" });
      await expect(
        getAlpacaAccountBalance(ALPACA_LIVE_TRADING_ACCOUNT_NAME, true),
      ).rejects.toThrow(ZodError);
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it("throws error if getAccount call fails", async () => {
      const mockError = new Error("Network Error");
      mockGetAccount.mockRejectedValue(mockError);
      await expect(
        getAlpacaAccountBalance(ALPACA_LIVE_TRADING_ACCOUNT_NAME, true),
      ).rejects.toThrow("Network Error");
      expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
    });
  });
});
