/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Alpaca from '@alpacahq/alpaca-trade-api';
import Decimal from 'decimal.js';
import { DEVELOPMENT_MODE } from "../actions.constants";
import {
  ALPACA_ACCOUNTS,
  ALPACA_TRADING_ACCOUNT_NAME_LIVE,
  ALPACA_TRADING_ACCOUNT_NAME_PAPER,
} from "./alpaca.constants";
import { type AlpacaAPIGetPosition, type AlpacaAccountCredentials, type AlpacaGetAvailableAssetBalance } from "./alpaca.types";

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
export const alpacaGetCredentials = (
  accountName: string = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
  developmentModeToggle: boolean = DEVELOPMENT_MODE,
): AlpacaAccountCredentials => {
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
    throw new Error('Alpaca account credentials not found');
  }
};


export const alpacaGetAvailableAssetBalance = async (
  symbol: string,
  accountName: string = ALPACA_TRADING_ACCOUNT_NAME_LIVE
): Promise<AlpacaGetAvailableAssetBalance> => {
  const credentials = alpacaGetCredentials(accountName);

  if (!credentials) {
    throw new Error('Alpaca account credentials not found');
  }

  const alpaca: Alpaca = new Alpaca({
    keyId: credentials.key,
    secretKey: credentials.secret,
    paper: credentials.paper
  });

  try {
    const positionDetails: AlpacaAPIGetPosition = await alpaca.getPosition(symbol) satisfies AlpacaAPIGetPosition;
    
    console.log(`Position for ${symbol}:`, positionDetails);
    console.log(`Quantity of ${symbol}:`, positionDetails.qty);
    console.log(`Market value for ${symbol}:`, positionDetails.market_value);

    return {
      position: positionDetails.position,
      qty: new Decimal(positionDetails.qty),
      market_value: new Decimal(positionDetails.market_value)
    } 

  } catch (error) {
    console.error(`Error getting position for ${symbol}:`, error);
    throw new Error(`Error getting position for: ${symbol}`);
  }
};