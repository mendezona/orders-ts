// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import {
  integer,
  numeric,
  pgTableCreator,
  serial, text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `orders_ts_${name}`);

export const assets = createTable("assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").unique().notNull(),
});

export const trades = createTable("trades", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").references(() => assets.id).notNull(),
  tradeTime: timestamp("trade_time", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  tradePrice: numeric("trade_price", { precision: 20, scale: 10 }).notNull(),
  quantity: numeric("quantity", { precision: 20, scale: 10 }).notNull(),
  tradeType: text("trade_type").notNull(),
});

export const allocations = createTable("allocations", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").references(() => assets.id).notNull(),
  allocatedAmount: numeric("allocated_amount", { precision: 20, scale: 10 }).notNull(),
  poolAmount: numeric("pool_amount", { precision: 20, scale: 10 }).notNull(),
});

export const profits = createTable("profits", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").references(() => trades.id).notNull(),
  profitAmount: numeric("profit_amount", { precision: 20, scale: 10 }).notNull(),
});
