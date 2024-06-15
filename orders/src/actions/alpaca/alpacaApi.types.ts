import { type UUID } from "crypto";

export interface AlpacaApiGetPosition extends Partial<Position> {
  position: string
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
  SUBMITTED = "SUBMITTED"
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
  EMPTY = ""
}

export enum AssetClass {
  US_EQUITY = "us_equity",
  US_OPTION = "us_option",
  CRYPTO = "crypto"
}

export enum PositionSide {
  SHORT = "short",
  LONG = "long"
}

export type RawData = Record<string, unknown>;
