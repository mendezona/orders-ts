CREATE TABLE IF NOT EXISTS "orders_ts_sellTrades" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"profit_amount" numeric(20, 10),
	"trade_time" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "orders_ts_sellTrades_symbol_unique" UNIQUE("symbol")
);
