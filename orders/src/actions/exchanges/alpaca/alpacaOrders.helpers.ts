/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import Alpaca from "@alpacahq/alpaca-trade-api";
import { type AlpacaQuote } from "@alpacahq/alpaca-trade-api/dist/resources/datav2/entityv2";
// import { type GetQuotesParams } from "@alpacahq/alpaca-trade-api/dist/resources/datav2/rest_v2";
import Decimal from "decimal.js";
import { ALPACA_TRADING_ACCOUNT_NAME_LIVE } from "./alpaca.constants";
// import getStartOfCurrentTradingDay from "./alpaca.helpers";
import { type AlpacaGetLatestQuote } from "./alpaca.types";
import { alpacaGetCredentials } from "./alpacaAccount.utils";
import {
  OrderSide,
  QueryOrderStatus,
  type Asset,
  type Order,
  type Position,
} from "./alpacaApi.types";

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

/**
 * Calculate the profit/loss amount on an asset's last trade. Looks at last open and close of an asset
 *
 * @param symbol - Symbol to check if asset is fractionable
 * @param accountName - Account to use to check if asset is fractionable
 *
 * @returns - A Decimal, a negative or positive number based on profit or loss calculation
 */
export const alpacaCalculateProfitLoss = async (
  symbol: string,
  accountName: string = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
): Promise<Decimal> => {
  const credentials = alpacaGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Alpaca account credentials not found");
  }

  const alpaca: Alpaca = new Alpaca({
    keyId: credentials.key,
    secretKey: credentials.secret,
    paper: credentials.paper,
  });

  // Fetch the most recent orders, considering a reasonable limit
  const orders: Order[] = await alpaca.getOrders({
    symbols: symbol,
    status: QueryOrderStatus.CLOSED,
    limit: 5,
    until: null,
    after: null,
    direction: null,
    nested: null,
  });

  // Find the most recent sell order
  const recentSellOrder: Order | undefined = [...orders]
    .reverse()
    .find((order) => order.side === OrderSide.SELL);

  if (!recentSellOrder?.filled_avg_price || !recentSellOrder.filled_qty) {
    throw new Error("No recent sell order found.");
  }

  const sellQuantityNeeded: Decimal = new Decimal(recentSellOrder.filled_qty);
  const avgSellPrice: Decimal = new Decimal(recentSellOrder.filled_avg_price);
  const sellPrice: Decimal = sellQuantityNeeded.times(avgSellPrice);
  let accumulatedBuyQuantity: Decimal = new Decimal(0);
  let totalBuyCost: Decimal = new Decimal(0);

  // Accumulate buy orders starting from the most recent
  for (const order of [...orders].reverse()) {
    if (order.side === OrderSide.BUY) {
      if (!!order.filled_qty && !!order.filled_avg_price) {
        const buyQuantity = new Decimal(order.filled_qty);
        const buyPrice = new Decimal(order.filled_avg_price);

        // Determine how much of this order to use
        const quantityToUse = Decimal.min(
          buyQuantity,
          sellQuantityNeeded.minus(accumulatedBuyQuantity),
        );
        totalBuyCost = !!order.notional
          ? new Decimal(order.notional)
          : totalBuyCost.plus(quantityToUse.times(buyPrice));
        accumulatedBuyQuantity = accumulatedBuyQuantity.plus(quantityToUse);

        if (accumulatedBuyQuantity.greaterThanOrEqualTo(sellQuantityNeeded)) {
          break;
        }
      }
    }
  }

  if (accumulatedBuyQuantity.lessThan(sellQuantityNeeded)) {
    throw new Error("Not enough buy orders to match the sell quantity.");
  }

  console.log("Buy price", totalBuyCost.toString());
  console.log("Sell price", sellPrice.toString());

  // Calculate profit or loss
  const profitLoss: Decimal = totalBuyCost.minus(sellPrice);
  console.log("Profit Loss:", profitLoss.toString());
  return profitLoss;
};

/**
 * Get the latest quote data for an asset, with two additional backup methods
 *
 * @param symbol - Symbol to check if asset is fractionable
 * @param accountName - Account to use to check if asset is fractionable
 *
 * @returns - A AlpacaGetLatestQuote object or an error object
 */
export const alpacaGetLatestQuote = async (
  symbol: string,
  accountName: string = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
): Promise<AlpacaGetLatestQuote> => {
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
    const getLatestQuoteData: AlpacaQuote = await alpaca.getLatestQuote(symbol);
    if (!!getLatestQuoteData.BidPrice || !!getLatestQuoteData.AskPrice) {
      const convertedQuoteData: AlpacaGetLatestQuote = {
        askPrice: new Decimal(getLatestQuoteData.AskPrice),
        bidPrice: new Decimal(getLatestQuoteData.BidPrice),
        askSize: new Decimal(getLatestQuoteData.AskSize),
        bidSize: new Decimal(getLatestQuoteData.BidSize),
      };

      console.log(
        "Quote Method 1 - Latest quote data found:",
        getLatestQuoteData,
      );
      return convertedQuoteData;
    }

    // // Backup method: getQuotesV2
    // const quotesParams: GetQuotesParams = {
    //   start: getStartOfCurrentTradingDay(),
    //   limit: 1,
    // };
    // const getQuotesData = alpaca.getQuotesV2(symbol, quotesParams);
    // for await (const quote of getQuotesData) {
    //   if (quote.BidPrice !== undefined || quote.AskPrice !== undefined) {
    //     const convertedQuoteData: AlpacaGetLatestQuote = {
    //       askPrice: new Decimal(quote.AskPrice),
    //       bidPrice: new Decimal(quote.BidPrice),
    //       askSize: new Decimal(quote.AskSize),
    //       bidSize: new Decimal(quote.BidSize),
    //     };

    //     console.log("Quote Method 2 - Quote data found:", convertedQuoteData);
    //     return convertedQuoteData;
    //   }
    // }

    console.error(`An error occurred while fetching quote data for ${symbol}`);
    throw new Error(`Error - quote data for ${symbol} not found`);
  } catch (error) {
    console.error(
      `An error occurred while fetching quote data for ${symbol}:`,
      error,
    );
    throw new Error(`Error - quote data for ${symbol} not found`);
  }
};

/**
 * Checks if there are any open positions for a given symbol.
 *
 * @param symbol - The symbol to check for open positions.
 * @param accountName - The account to use for checking holdings.
 *
 * @returns - A boolean indicating if the holdings for the specified symbol are closed.
 */
export const alpacaAreHoldingsClosed = async (
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
    const openPositions = (await alpaca.getPositions()) satisfies Position[];
    for (const position of openPositions) {
      if (position.symbol === symbol && parseFloat(position.qty) > 0) {
        console.log(`Open position for ${symbol} found`);
        return false;
      }
    }

    console.log(`All positions for ${symbol} have been closed`);
    return true;
  } catch (error) {
    console.error(`Error - position data for ${symbol}:`, error);
    throw new Error(`Error - position data for ${symbol} not found`);
  }
};
