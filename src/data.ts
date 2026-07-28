import type { Asset, Goal, Transaction } from './types'

export const categories = [
  ['Mercado','🛒'], ['Moradia','🏠'], ['Delivery','🍕'], ['Combustível','⛽'], ['Academia','🏋️'], ['Farmácia','💊'], ['Lazer','🎬']
] as const
export const seedTransactions: Transaction[] = [
  { id:'1', kind:'income', value:5000, description:'Salário mensal', category:'Renda', pillar:'common', date:'2026-07-01' },
  { id:'2', kind:'expense', value:486.2, description:'Compras do mês', category:'Mercado', pillar:'common', date:'2026-07-05' },
  { id:'3', kind:'expense', value:119.9, description:'Mensalidade', category:'Academia', pillar:'common', date:'2026-07-08' },
  { id:'4', kind:'expense', value:84.5, description:'Jantar', category:'Delivery', pillar:'common', date:'2026-07-12' },
]
export const seedAssets: Asset[] = [
  { id:'1', ticker:'HGLG11', type:'FII', quantity:15, averagePrice:160, currentPrice:164.72 },
  { id:'2', ticker:'Tesouro IPCA+ 2035', type:'Renda fixa', quantity:1, averagePrice:5000, currentPrice:5322 },
  { id:'3', ticker:'CDB 110% CDI', type:'Renda fixa', quantity:1, averagePrice:3000, currentPrice:3168 },
]
export const seedGoals: Goal[] = [
  { id:'1', name:'Reserva de emergência', value:7500, target:18000, cdi:100 },
  { id:'2', name:'Viagem', value:2800, target:8000, cdi:105 },
]
