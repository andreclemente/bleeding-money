import type { SavingsFinding } from './types'

const penalties = { info: 5, low: 12, medium: 24, high: 36 }
export const calculateHealthScore = (findings: SavingsFinding[]) => Math.max(0, Math.min(100, Math.round(100 - findings.filter(item => item.status === 'open').reduce((sum, item) => sum + penalties[item.severity] * Math.max(0, Math.min(1, item.confidence)), 0))))
export const healthLabel = (score: number) => score >= 90 ? 'excelente' : score >= 70 ? 'saudável' : score >= 50 ? 'atenção' : 'provavelmente existe desperdício'
