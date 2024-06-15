CREATE TABLE IF NOT EXISTS "orders_ts_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"allocated_amount" numeric(20, 10) NOT NULL,
	"pool_amount" numeric(20, 10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders_ts_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	CONSTRAINT "orders_ts_assets_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders_ts_profits" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" integer NOT NULL,
	"profit_amount" numeric(20, 10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders_ts_trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"trade_time" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"trade_price" numeric(20, 10) NOT NULL,
	"quantity" numeric(20, 10) NOT NULL,
	"trade_type" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders_ts_allocations" ADD CONSTRAINT "orders_ts_allocations_asset_id_orders_ts_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."orders_ts_assets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders_ts_profits" ADD CONSTRAINT "orders_ts_profits_trade_id_orders_ts_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."orders_ts_trades"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders_ts_trades" ADD CONSTRAINT "orders_ts_trades_asset_id_orders_ts_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."orders_ts_assets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
