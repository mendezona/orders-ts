import { type buyTrades, type sellTrades } from "./db/schema";

export type BuyTrade = typeof buyTrades.$inferSelect;

export type SellTrade = typeof sellTrades.$inferSelect;

export type SaveSellTradeToDatabaseBuyTableProps = Omit<
  BuyTrade,
  "id" | "tradeTime"
>;

export type SaveSellTradeToDatabaseSellTableProps = Omit<
  SellTrade,
  "id" | "tradeTime"
>;
