import type { Asset, Goal, Transaction } from './types'

export const categories = [
  ['Mercado','🛒'], ['Moradia','🏠'], ['Delivery','🍕'], ['Combustível','⛽'], ['Academia','🏋️'], ['Farmácia','💊'], ['Lazer','🎬']
] as const
export const seedTransactions: Transaction[] = []
export const seedAssets: Asset[] = []
export const seedGoals: Goal[] = []
