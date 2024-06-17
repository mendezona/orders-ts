CREATE TABLE IF NOT EXISTS "orders_ts_buyTrades" (
	"id" serial PRIMARY KEY NOT NULL,
	"exchange" text NOT NULL,
	"symbol" text NOT NULL,
	"price" numeric(20, 10) NOT NULL,
	"trade_time" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
