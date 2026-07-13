// Event bus mínimo — a UI assina eventos; sistemas emitem (PRD §26.3).
const listeners = new Map();

export const bus = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
  },
  emit(event, payload) {
    listeners.get(event)?.forEach((fn) => {
      try { fn(payload); } catch (err) { console.error(`[bus:${event}]`, err); }
    });
  },
};
