import { RealmConfigRepository } from '../../domain/ports/RealmConfigRepository';
import { RealmConfigSource } from '../../domain/ports/RealmConfigSource';
import { RealmConfigReloader } from '../../domain/ports/RealmConfigReloader';
import { RealmConfigSet, realmConfigSetFromRows } from '../../domain/config/realms';

// In-app cache of the realm config. Loads from the DB once (ensureLoaded) and
// serves it synchronously (get) so the domain use cases keep synchronous access.
// No TTL: the only thing that changes the config is an admin write, which calls
// reload() explicitly — precise invalidation rather than time-based polling.
export class RealmConfigProvider implements RealmConfigSource, RealmConfigReloader {
  private set: RealmConfigSet | null = null;
  private loading: Promise<void> | null = null;

  constructor(private readonly repo: RealmConfigRepository) {}

  // Idempotent and concurrency-safe: parallel first requests share one in-flight
  // load instead of each hitting the DB.
  async ensureLoaded(): Promise<void> {
    if (this.set) return;
    if (!this.loading) {
      // Clear this.loading in finally regardless of outcome: a rejected load
      // (e.g. a transient DB error at boot) must be retryable by the next call,
      // not cached forever as a permanently-rejected promise.
      this.loading = this.repo
        .loadAll()
        .then((rows) => {
          this.set = realmConfigSetFromRows(rows);
        })
        .finally(() => {
          this.loading = null;
        });
    }
    await this.loading;
  }

  async reload(): Promise<void> {
    const rows = await this.repo.loadAll();
    this.set = realmConfigSetFromRows(rows);
  }

  get(): RealmConfigSet {
    if (!this.set) {
      throw new Error('RealmConfigProvider.get() called before ensureLoaded()');
    }
    return this.set;
  }
}
