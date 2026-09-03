export type Pillar = "common" | "reserve" | "investments";
export type EntryKind = "income" | "expense";
export interface Transaction {
  id: string;
  kind: EntryKind;
  value: number;
  description: string;
  category: string;
  pillar: Pillar;
  date: string;
  reserveId?: string;
  reserveName?: string;
  reversed?: boolean;
}
export interface Distribution {
  reserve: number;
  investments: number;
}
export interface UserCategory {
  id: string;
  name: string;
  emoji: string;
}
export interface Asset {
  id: string;
  ticker: string;
  type: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
}
export interface Goal {
  id: string;
  name: string;
  institution?: string;
  value: number;
  target: number;
  cdi: number;
}
export type MoneyLocation = "common" | "reserve" | `goal:${string}`;
export interface MoneyTransfer {
  id: string;
  from: MoneyLocation;
  to: MoneyLocation;
  value: number;
  date: string;
  reversed: boolean;
}
