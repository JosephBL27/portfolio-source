// Tiny typed event bus shared by every module.
type Events = {
  theme: { night: boolean }
  pause: { paused: boolean }
  sound: { on: boolean }
  dispatch: { id: string }
  deskclose: { id: string }
  pulse: { node?: number }
  station: { id: string | null }
}
type Handler<K extends keyof Events> = (e: Events[K]) => void
const map = new Map<keyof Events, Set<Handler<any>>>()
export const bus = {
  on<K extends keyof Events>(k: K, h: Handler<K>) { if (!map.has(k)) map.set(k, new Set()); map.get(k)!.add(h); return () => map.get(k)!.delete(h) },
  emit<K extends keyof Events>(k: K, e: Events[K]) { map.get(k)?.forEach(h => h(e)) },
}
