import type { Repository } from "./db.js";
import type { RunEvent } from "./types.js";

type Listener = (event: RunEvent) => void;
const listeners = new Map<string, Set<Listener>>();

export function subscribe(runId: string, listener: Listener) {
  const set = listeners.get(runId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(runId, set);
  return () => {
    set.delete(listener);
  };
}

export function emit(repo: Repository, runId: string, kind: string, message: string, data?: unknown) {
  const event = repo.addEvent(runId, kind, message, data);
  for (const listener of listeners.get(runId) ?? []) listener(event);
  return event;
}
