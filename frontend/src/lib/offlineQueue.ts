type QueueItem = {
  id: string;
  label: string;
  run: () => Promise<void>;
  retries: number;
};

class OfflineQueue {
  private items: QueueItem[] = [];
  private processing = false;
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.flush());
    }
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  get pendingCount() {
    return this.items.length;
  }

  get isProcessing() {
    return this.processing;
  }

  enqueue(label: string, run: () => Promise<void>) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.items.push({ id, label, run, retries: 0 });
    this.notify();
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void this.flush();
    }
  }

  async flush() {
    if (this.processing || this.items.length === 0) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    this.processing = true;
    this.notify();

    while (this.items.length > 0) {
      const item = this.items[0];
      try {
        await item.run();
        this.items.shift();
      } catch {
        item.retries += 1;
        if (item.retries >= 3) {
          this.items.shift();
        }
        break;
      }
    }

    this.processing = false;
    this.notify();
  }
}

export const offlineQueue = new OfflineQueue();

export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  return false;
}

export function enqueueOrRun(label: string, run: () => Promise<void>): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return new Promise((resolve, reject) => {
      offlineQueue.enqueue(label, async () => {
        try {
          await run();
          resolve();
        } catch (e) {
          reject(e);
          throw e;
        }
      });
    });
  }
  return run();
}
