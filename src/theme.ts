// Shared palette. Day post (default) and Night shift. Hex strings so both DOM and three.js can use them.
export const DAY = {
  paper: '#EEECE6', paperRaised: '#F7F5F0', ink: '#121212', graphite: '#5A5853', rule: '#CBC7BD',
  brain: '#E0442B', brainText: '#C7381F', inbound: '#2747C9', delivered: '#E9B321', running: '#1E7A47',
  glassTint: '#DDE3E6',
} as const
export const NIGHT = {
  paper: '#0E0F10', paperRaised: '#17191B', ink: '#ECEAE3', graphite: '#9A978F', rule: '#2C2E31',
  brain: '#FF6A4D', brainText: '#FF6A4D', inbound: '#6F8CFF', delivered: '#F2C14E', running: '#4CC38A',
  glassTint: '#20262A',
} as const
export type Palette = { [K in keyof typeof DAY]: string }
export const palette = (night: boolean): Palette => (night ? NIGHT : DAY)
