import Decimal from "decimal.js";

export const EXCHANGE_LOCAL_TIMEZONE = "Europe/Berlin";

export const EXCHANGE_CAPITAL_GAINS_TAX_RATE = new Decimal(0.26375);

export enum EXCHANGES {
  ALPACA = "ALPACA",
  BYBIT = "BYBIT",
}
