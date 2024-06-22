export interface BybitAccountCredentials {
  key: string;
  secret: string;
  testnet: boolean;
}

export enum BybitDefaultProductCategory {
  SPOT = "spot",
}

export enum BybitAccountType {
  UNIFIED = "UNIFIED",
}
