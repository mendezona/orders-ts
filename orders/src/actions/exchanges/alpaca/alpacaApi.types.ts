import { type UUID } from "crypto";

export interface AlpacaApiGetPosition extends Partial<Position> {
  position: string;
}

export interface Position {
  asset_id: UUID;
  symbol: string;
  exchange: AssetExchange;
  asset_class: AssetClass;
  asset_marginable?: boolean;
  avg_entry_price: string;
  qty: string;
  side: PositionSide;
  market_value?: string;
  cost_basis: string;
  unrealized_pl?: string;
  unrealized_plpc?: string;
  unrealized_intraday_pl?: string;
  unrealized_intraday_plpc?: string;
  current_price?: string;
  lastday_price?: string;
  change_today?: string;
  swap_rate?: string;
  avg_entry_swap_rate?: string;
  usd?: USDPositionValues;
  qty_available?: string;
}

export interface AlapcaApiTradingAccount {
  id: UUID;
  account_number: string;
  status: AccountStatus;
  crypto_status?: AccountStatus;
  currency?: string;
  buying_power?: string;
  regt_buying_power?: string;
  daytrading_buying_power?: string;
  non_marginable_buying_power?: string;
  cash?: string;
  accrued_fees?: string;
  pending_transfer_out?: string;
  pending_transfer_in?: string;
  portfolio_value?: string;
  pattern_day_trader?: boolean;
  trading_blocked?: boolean;
  transfers_blocked?: boolean;
  account_blocked?: boolean;
  created_at?: Date;
  trade_suspended_by_user?: boolean;
  multiplier?: string;
  shorting_enabled?: boolean;
  equity?: string;
  last_equity?: string;
  long_market_value?: string;
  short_market_value?: string;
  initial_margin?: string;
  maintenance_margin?: string;
  last_maintenance_margin?: string;
  sma?: string;
  daytrade_count?: number;
  options_buying_power?: string;
  options_approved_level?: number;
  options_trading_level?: number;
}

export interface TradeAccount {
  id: UUID;
  account_number: string;
  status: AccountStatus;
  crypto_status?: AccountStatus;
  currency?: string;
  buying_power?: string;
  regt_buying_power?: string;
  daytrading_buying_power?: string;
  non_marginable_buying_power?: string;
  cash?: string;
  accrued_fees?: string;
  pending_transfer_out?: string;
  pending_transfer_in?: string;
  portfolio_value?: string;
  pattern_day_trader?: boolean;
  trading_blocked?: boolean;
  transfers_blocked?: boolean;
  account_blocked?: boolean;
  created_at?: Date;
  trade_suspended_by_user?: boolean;
  multiplier?: string;
  shorting_enabled?: boolean;
  equity?: string;
  last_equity?: string;
  long_market_value?: string;
  short_market_value?: string;
  initial_margin?: string;
  maintenance_margin?: string;
  last_maintenance_margin?: string;
  sma?: string;
  daytrade_count?: number;
  options_buying_power?: string;
  options_approved_level?: number;
  options_trading_level?: number;
}

export interface Order {
  id: UUID;
  client_order_id: string;
  created_at: Date;
  updated_at: Date;
  submitted_at: Date;
  filled_at?: Date;
  expired_at?: Date;
  canceled_at?: Date;
  failed_at?: Date;
  replaced_at?: Date;
  replaced_by?: UUID;
  replaces?: UUID;
  asset_id: UUID;
  symbol: string;
  asset_class: AssetClass;
  notional?: string;
  qty?: string | number;
  filled_qty?: string | number;
  filled_avg_price?: string | number;
  order_class: OrderClass;
  order_type: OrderType;
  type: OrderType;
  side: OrderSide;
  time_in_force: TimeInForce;
  limit_price?: string | number;
  stop_price?: string | number;
  status: OrderStatus;
  extended_hours: boolean;
  legs?: Order[];
  trail_percent?: string;
  trail_price?: string;
  hwm?: string;
}

export interface OrderRequest {
  symbol: string;
  qty?: number;
  notional?: number;
  side: OrderSide;
  type: OrderType;
  time_in_force: TimeInForce;
  limit_price?: number; // optional
  stop_price?: number; // optional
  client_order_id?: string; // optional
  extended_hours?: boolean; // optional
  order_class?: string; // optional
  take_profit?: object; // optional
  stop_loss?: object; // optional
  trail_price?: string; // optional
  trail_percent?: string; // optional
}

export interface Asset {
  id: UUID;
  asset_class: AssetClass;
  exchange: AssetExchange;
  symbol: string;
  name?: string;
  status: AssetStatus;
  tradable: boolean;
  marginable: boolean;
  shortable: boolean;
  easy_to_borrow: boolean;
  fractionable: boolean;
  min_order_size?: number;
  min_trade_increment?: number;
  price_increment?: number;
  maintenance_margin_requirement?: number;
  attributes?: string[];
}

export interface USDPositionValues {
  avg_entry_price: string;
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  unrealized_intraday_pl: string;
  unrealized_intraday_plpc: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}

export enum AccountStatus {
  ACCOUNT_CLOSED = "ACCOUNT_CLOSED",
  ACCOUNT_UPDATED = "ACCOUNT_UPDATED",
  ACTION_REQUIRED = "ACTION_REQUIRED",
  ACTIVE = "ACTIVE",
  AML_REVIEW = "AML_REVIEW",
  APPROVAL_PENDING = "APPROVAL_PENDING",
  APPROVED = "APPROVED",
  DISABLED = "DISABLED",
  DISABLE_PENDING = "DISABLE_PENDING",
  EDITED = "EDITED",
  INACTIVE = "INACTIVE",
  KYC_SUBMITTED = "KYC_SUBMITTED",
  LIMITED = "LIMITED",
  ONBOARDING = "ONBOARDING",
  PAPER_ONLY = "PAPER_ONLY",
  REAPPROVAL_PENDING = "REAPPROVAL_PENDING",
  REJECTED = "REJECTED",
  RESUBMITTED = "RESUBMITTED",
  SIGNED_UP = "SIGNED_UP",
  SUBMISSION_FAILED = "SUBMISSION_FAILED",
  SUBMITTED = "SUBMITTED",
}

export enum AssetExchange {
  AMEX = "AMEX",
  ARCA = "ARCA",
  BATS = "BATS",
  NYSE = "NYSE",
  NASDAQ = "NASDAQ",
  NYSEARCA = "NYSEARCA",
  FTXU = "FTXU",
  CBSE = "CBSE",
  GNSS = "GNSS",
  ERSX = "ERSX",
  OTC = "OTC",
  CRYPTO = "CRYPTO",
  EMPTY = "",
}

export enum AssetClass {
  US_EQUITY = "us_equity",
  US_OPTION = "us_option",
  CRYPTO = "crypto",
}

export enum QueryOrderStatus {
  OPEN = "open",
  CLOSED = "closed",
  ALL = "all",
}

export enum PositionSide {
  SHORT = "short",
  LONG = "long",
}

export enum OrderSide {
  BUY = "buy",
  SELL = "sell",
}

export enum OrderClass {
  SIMPLE = "simple",
  BRACKET = "bracket",
  OCO = "oco",
  OTO = "oto",
}

export enum OrderType {
  MARKET = "market",
  LIMIT = "limit",
  STOP = "stop",
  STOP_LIMIT = "stop_limit",
  TRAILING_STOP = "trailing_stop",
}

export enum TimeInForce {
  DAY = "day",
  GTC = "gtc",
  OPG = "opg",
  CLS = "cls",
  IOC = "ioc",
  FOK = "fok",
}

export enum OrderStatus {
  NEW = "new",
  PARTIALLY_FILLED = "partially_filled",
  FILLED = "filled",
  DONE_FOR_DAY = "done_for_day",
  CANCELED = "canceled",
  EXPIRED = "expired",
  REPLACED = "replaced",
  PENDING_CANCEL = "pending_cancel",
  PENDING_REPLACE = "pending_replace",
  PENDING_REVIEW = "pending_review",
  ACCEPTED = "accepted",
  PENDING_NEW = "pending_new",
  ACCEPTED_FOR_BIDDING = "accepted_for_bidding",
  STOPPED = "stopped",
  REJECTED = "rejected",
  SUSPENDED = "suspended",
  CALCULATED = "calculated",
  HELD = "held",
}

export enum AssetStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export type RawData = Record<string, unknown>;
