import * as Sentry from "@sentry/nextjs";
import {
  RestClientV5,
  type LinearInverseInstrumentInfoV5,
  type OptionInstrumentInfoV5,
  type SpotInstrumentInfoV5,
} from "bybit-api";
import { removeHyphensFromPairSymbol } from "../exchanges.utils";
import { BYBIT_LIVE_TRADING_ACCOUNT_NAME } from "./bybit.constants";
import {
  BybitDefaultProductCategory,
  type BybitAccountCredentials,
  type BybitGetSymbolIncrementsParams,
} from "./bybit.types";
import { bybitGetCredentials } from "./bybitAcccount.utils";

/**
 * Retrieves information about required increments for an order.
 *
 * @param bybitPairSymbol - Pair symbol to search for information with hyphens removed (e.g., "BTC-USDT").
 * @param accountName - The name of the account to use.
 * @param productCategory - The category of the instrument to search for (e.g., spot, linear inverse, or option).
 *
 * @returns The instrument information for the specified pair symbol.
 */
export const bybitGetSymbolIncrements = async ({
  bybitPairSymbol,
  accountName = BYBIT_LIVE_TRADING_ACCOUNT_NAME,
  productCategory = BybitDefaultProductCategory.SPOT,
}: BybitGetSymbolIncrementsParams): Promise<
  SpotInstrumentInfoV5 | LinearInverseInstrumentInfoV5 | OptionInstrumentInfoV5
> => {
  const credentials: BybitAccountCredentials = bybitGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Bybit account credentials not found");
  }

  const parsedBybitPairSymbol = removeHyphensFromPairSymbol(bybitPairSymbol);
  try {
    const client = new RestClientV5({
      key: credentials.key,
      secret: credentials.secret,
      testnet: credentials.testnet,
    });

    const assetInfo = await client.getInstrumentsInfo({
      symbol: parsedBybitPairSymbol,
      category: productCategory,
    });

    if (assetInfo.retCode === 0) {
      for (const tradingPairAssetInfo of assetInfo.result.list) {
        if (tradingPairAssetInfo.symbol === parsedBybitPairSymbol) {
          console.log("Trading pair asset info found:", tradingPairAssetInfo);
          return tradingPairAssetInfo;
        }
      }
    }

    throw new Error(
      `bybitGetSymbolIncrements - Error getting symbol increments for ${parsedBybitPairSymbol}`,
    );
  } catch (error) {
    Sentry.captureException(error);
    console.error(
      `bybitGetSymbolIncrements - Error getting symbol increments for ${parsedBybitPairSymbol}`,
    );
    throw error;
  }
};
