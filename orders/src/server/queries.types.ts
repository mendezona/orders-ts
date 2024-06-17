import { type buyTrades, type sellTrades } from "./db/schema";

export type BuyTrade = typeof buyTrades.$inferSelect;

export type SellTrade = typeof sellTrades.$inferSelect;

export type SaveSellTradeToDatabaseBuyTableProps = Omit<
  BuyTrade,
  "id" | "tradeTime"
>;

export interface SaveSellTradeToDatabaseSellTableProps
  extends Omit<SellTrade, "id" | "tradeTime"> {
  buyAlert: boolean;
}

export type BuyTableItem = Omit<BuyTrade, "id">;
