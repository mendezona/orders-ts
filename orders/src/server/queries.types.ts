import { type sellTrades } from "./db/schema";

export type SellTrade = typeof sellTrades.$inferSelect;

export type SaveTradeToDatabaseProps = Omit<SellTrade, "id" | "tradeTime">;
