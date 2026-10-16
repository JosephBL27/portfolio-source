// Form registry: every src/v3/forms/<id>.ts that default-exports a FormDef (or FormDef[]).
import type { FormDef } from './types'
const mods = import.meta.glob<{ default: FormDef | FormDef[] }>(['./*.ts', '!./types.ts', '!./index.ts', '!./ctx.ts'], { eager: true })
export const FORMS: Record<string, FormDef> = {}
for (const m of Object.values(mods)) {
  const d = m.default
  for (const f of Array.isArray(d) ? d : d ? [d] : []) FORMS[f.id] = f
}
export type { FormDef }
