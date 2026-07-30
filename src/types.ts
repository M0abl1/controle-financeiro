export type Pillar = 'common' | 'reserve' | 'investments'
export type EntryKind = 'income' | 'expense'
export interface Transaction { id: string; kind: EntryKind; value: number; description: string; category: string; pillar: Pillar; date: string }
export interface Distribution { reserve: number; investments: number }
export interface Asset { id: string; ticker: string; type: string; quantity: number; averagePrice: number; currentPrice: number }
export interface Goal { id: string; name: string; value: number; target: number; cdi: number }
