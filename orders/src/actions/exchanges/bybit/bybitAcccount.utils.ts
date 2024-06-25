import * as Sentry from "@sentry/nextjs";
import { RestClientV5 } from "bybit-api";
import { DEVELOPMENT_MODE } from "~/actions/actions.constants";
import {
  BYBIT_ACCOUNTS,
  BYBIT_LIVE_TRADING_ACCOUNT_NAME,
  BYBIT_PAPER_TRADING_ACCOUNT_NAME,
} from "./bybit.constants";
import { BybitAccountType, type BybitAccountCredentials } from "./bybit.types";

/**
 * Retrieves the account credentials for trading (most likely paper trading account or live account).
 *
 * @param accountName - The name of the account to trade with.
 * @param developmentModeToggle - Forcibly enable development mode.
 *
 * @returns An BybitAccountCredentials object containing the key, secret, and testnet.
 */
export const bybitGetCredentials = (
  accountName: string = BYBIT_LIVE_TRADING_ACCOUNT_NAME,
  developmentModeToggle: boolean = DEVELOPMENT_MODE,
): BybitAccountCredentials => {
  const accountInfo: BybitAccountCredentials | undefined =
    !developmentModeToggle
      ? BYBIT_ACCOUNTS[accountName]
      : BYBIT_ACCOUNTS[BYBIT_PAPER_TRADING_ACCOUNT_NAME];

  if (accountInfo) {
    console.log("Bybit account credentials found");
    return {
      key: accountInfo.key,
      secret: accountInfo.secret,
      testnet: accountInfo.testnet,
    };
  } else {
    const errorMessage = "Bybit account credentials not found";
    console.log(errorMessage);
    Sentry.captureMessage(errorMessage);
    throw new Error(errorMessage);
  }
};

/**
 * Retrieves the account balance for a specific coin from Bybit
 *
 * @param coin - The coin symbol (e.g., "BTC").
 * @param accountName - The name of the account to use.
 *
 * @returns The account balance for the specified coin as a string or an error message as a string.
 */
export const bybitGetCoinBalance = async (
  coin: string,
  accountName: string = BYBIT_LIVE_TRADING_ACCOUNT_NAME,
): Promise<string> => {
  console.log("bybitGetCoinBalance - finding balance for:", coin);
  const credentials: BybitAccountCredentials = bybitGetCredentials(accountName);

  try {
    const client = new RestClientV5({
      key: credentials.key,
      secret: credentials.secret,
      testnet: credentials.testnet,
    });

    const walletBalance = await client.getWalletBalance({
      accountType: BybitAccountType.UNIFIED,
      coin,
    });

    console.log("bybitGetCoinBalance - wallet balance:", walletBalance);

    if (walletBalance.retCode === 0) {
      for (const item of walletBalance.result.list) {
        for (const coinInfo of item.coin) {
          if (coinInfo.coin === coin) {
            console.log(
              `bybitGetCoinBalance - balance for ${coin}:`,
              coinInfo.walletBalance,
            );
            return coinInfo.walletBalance;
          }
        }
      }
    }

    const errorMessage = "Coin balance not found";
    console.log(errorMessage);
    Sentry.captureMessage(errorMessage);
    throw new Error(errorMessage);
  } catch (error) {
    Sentry.captureException(error);
    console.error(`Error getting balance for ${coin}:`);
    throw error;
  }
};
