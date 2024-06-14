import { DEVELOPMENT_MODE } from "../actions.constants";
import {
  ALPACA_ACCOUNTS,
  ALPACA_TRADING_ACCOUNT_NAME_LIVE,
  ALPACA_TRADING_ACCOUNT_NAME_PAPER,
} from "./alpaca.constants";
import { type AlpacaAccountCredentials } from "./alpaca.types";

/**
 * Retrieves the account credentials for trading (most likely paper trading
 * account or live account)
 *
 * Parameters:
 * - accountName: The name of the account to trade with
 * - developmentModeToggle: Forcely enable development mode
 *
 * Returns:
 * - A AlpacaAccountCredentials object containing the endpoint, key, secret,
 *   and paper, to pass to the Bybit SDK API
 */
export const getAlpacaCredentials = (
  accountName: string = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
  developmentModeToggle: boolean = DEVELOPMENT_MODE,
): AlpacaAccountCredentials | undefined => {
  const accountInfo: AlpacaAccountCredentials | undefined =
    !developmentModeToggle
      ? ALPACA_ACCOUNTS[accountName]
      : ALPACA_ACCOUNTS[ALPACA_TRADING_ACCOUNT_NAME_PAPER];

  if (accountInfo) {
    console.log("Alpaca account credentials found");
    return {
      endpoint: accountInfo.endpoint,
      key: accountInfo.key,
      secret: accountInfo.secret,
      paper: accountInfo.paper,
    };
  } else {
    console.error("Alpaca account credentials not found");
    return undefined;
  }
};
