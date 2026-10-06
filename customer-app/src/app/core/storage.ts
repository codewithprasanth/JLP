// Storage can throw (private mode, blocked site data) — never let that break the app.
export function readStore(key: string, store: Storage = localStorage): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

export function writeStore(key: string, value: string | null, store: Storage = localStorage): void {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* ignore */
  }
}
