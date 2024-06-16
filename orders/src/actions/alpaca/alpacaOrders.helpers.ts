/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Alpaca from "@alpacahq/alpaca-trade-api";
import { ALPACA_TRADING_ACCOUNT_NAME_LIVE } from "./alpaca.constants";
import { alpacaGetCredentials } from "./alpacaAccount.utils";
import { type Asset } from "./alpacaApi.types";

/**
 * Checks if asset is fractionable, or if only whole orders can be submitted
 *
 * @param symbol - Symbol to check if asset is fractionable
 * @param account - Account to use to check if asset is fractionable
 *
 * @returns - A Boolean, true if the asset is fractionable (e.g., 0.10 quantity is accepted)
 */
export const alpacaIsAssetFractionable = async (
  symbol: string,
  accountName: string = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
): Promise<boolean> => {
  const credentials = alpacaGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Alpaca account credentials not found");
  }

  const alpaca: Alpaca = new Alpaca({
    keyId: credentials.key,
    secretKey: credentials.secret,
    paper: credentials.paper,
  });

  try {
    const asset: Asset = (await alpaca.getAsset(symbol)) satisfies Asset;
    if (!asset.fractionable) {
      throw new Error("Unable to determine if asset is fractionable");
    }
    console.log(`${symbol} fractionable:`, asset.fractionable);
    return asset.fractionable;
  } catch (error) {
    console.error(
      `Error - Unable to determine if asset is fractionable:`,
      error,
    );
    throw new Error(`Error - Unable to determine if asset is fractionable`);
  }
};
