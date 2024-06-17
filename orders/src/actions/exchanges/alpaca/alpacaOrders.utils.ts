import Alpaca from "@alpacahq/alpaca-trade-api";
import Decimal from "decimal.js";
import { logTimesInNewYorkAndLocalTimezone } from "../exchanges.utils";
import { ALPACA_TRADING_ACCOUNT_NAME_LIVE } from "./alpaca.constants";
import { type AlpacaGetLatestQuote } from "./alpaca.types";
import {
  alpacaGetAccountBalance,
  alpacaGetCredentials,
} from "./alpacaAccount.utils";
import {
  OrderSide,
  OrderType,
  TimeInForce,
  type OrderRequest,
} from "./alpacaApi.types";
import {
  alpacaGetLatestQuote,
  alpacaIsAssetFractionable,
} from "./alpacaOrders.helpers";

/**
 * Submits a market order to Alpaca based on a percentage of account equity.
 *
 * @param alpacaSymbol - The symbol of the asset to trade.
 * @param buySideOrder - Whether to buy or sell the asset.
 * @param capitalPercentageToDeploy - The percentage of account equity to deploy.
 * @param accountName - The name of the Alpaca trading account.
 * @param orderType - The type of order to submit.
 * @param timeInForce - The time in force for the order.
 *
 * @returns - Current time in New York and the specified local timezone, formatted as "YYYY-MM-DD HH:mm:ss".
 */
export const alpacaSubmitMarketOrderCustomPercentage = async (
  alpacaSymbol: string,
  buySideOrder = true,
  capitalPercentageToDeploy = 1.0,
  accountName: string = ALPACA_TRADING_ACCOUNT_NAME_LIVE,
  orderType: OrderType = OrderType.MARKET,
  timeInForce: TimeInForce = TimeInForce.DAY,
): Promise<void> => {
  const credentials = alpacaGetCredentials(accountName);
  if (!credentials) {
    throw new Error("Alpaca account credentials not found");
  }

  console.log("Alpaca Order Begin - alpacaSubmitMarketOrderCustomPercentage");
  logTimesInNewYorkAndLocalTimezone();

  const accountInfo = await alpacaGetAccountBalance(accountName);
  const accountEquity = accountInfo.accountEquity;
  const accountCash = accountInfo.accountCash;
  const capitalPercentage = new Decimal(capitalPercentageToDeploy);
  let fundsToDeploy: Decimal = accountEquity
    .mul(capitalPercentage)
    .toDecimalPlaces(2, Decimal.ROUND_DOWN);

  if (fundsToDeploy.lte(0)) {
    console.log("Error - Insufficient funds to deploy");
    throw new Error("Error - Insufficient funds to deploy");
  }

  if (fundsToDeploy.gt(accountCash)) {
    fundsToDeploy = accountCash;
  }

  let orderRequest: OrderRequest;
  const orderSide: OrderSide = buySideOrder ? OrderSide.BUY : OrderSide.SELL;
  const fractionable: boolean = await alpacaIsAssetFractionable(
    alpacaSymbol,
    accountName,
  );

  if (fractionable) {
    orderRequest = {
      symbol: alpacaSymbol,
      notional: fundsToDeploy.toNumber(),
      side: orderSide,
      type: orderType,
      time_in_force: timeInForce,
    };
  } else {
    const latestQuote: AlpacaGetLatestQuote = await alpacaGetLatestQuote(
      alpacaSymbol,
      accountName,
    );
    const price: Decimal = latestQuote.bidPrice.eq(0)
      ? latestQuote.askPrice
      : latestQuote.bidPrice;
    const quantity: Decimal = fundsToDeploy
      .mul(0.97)
      .div(price)
      .toDecimalPlaces(0, Decimal.ROUND_DOWN);

    orderRequest = {
      symbol: alpacaSymbol,
      qty: quantity.toNumber(),
      side: orderSide,
      type: orderType,
      time_in_force: timeInForce,
    };
  }

  try {
    const alpaca: Alpaca = new Alpaca({
      keyId: credentials.key,
      secretKey: credentials.secret,
      paper: credentials.paper,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const orderResponse = await alpaca.createOrder(orderRequest);
    console.log("orderRequest:", orderRequest);
    console.log(`Market ${orderSide} order submitted: \n`, orderResponse);
    console.log("Alpaca Order End - alpacaSubmitMarketOrderCustomPercentage");
  } catch (error) {
    console.error("Error - alpacaSubmitMarketOrderCustomPercentage:", error);
    throw new Error(
      "Error - alpacaSubmitMarketOrderCustomPercentage unable to execute",
    );
  }
};
