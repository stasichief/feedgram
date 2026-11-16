/**
 * Minimal reactive store.
 *
 * Inferno has no React-style hooks (`useState` / `useEffect` do not exist in
 * any Inferno release), so state lives in small observable stores and
 * components subscribe to them manually.
 */

export type Unsubscribe = () => void;

export class Store<T extends object> {
  private state: T;
  private listeners = new Set<(state: T) => void>();

  constructor(initial: T) {
    this.state = initial;
  }

  get(): Readonly<T> {
    return this.state;
  }

  set(patch: Partial<T> | ((state: Readonly<T>) => Partial<T>)): void {
    const next = typeof patch === 'function' ? patch(this.state) : patch;
    let changed = false;
    for (const key of Object.keys(next) as (keyof T)[]) {
      if (!Object.is(this.state[key], next[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...next };
    for (const listener of Array.from(this.listeners)) {
      listener(this.state);
    }
  }

  subscribe(listener: (state: T) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

/** Runs a callback when any of the given stores change. */
export function subscribeAll(
  stores: Array<Store<any>>,
  callback: () => void,
): Unsubscribe {
  const unsubscribes = stores.map((store) =>
    store.subscribe(() => callback()),
  );
  return () => unsubscribes.forEach((fn) => fn());
}
