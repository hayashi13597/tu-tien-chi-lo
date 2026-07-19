import { RealmConfigSet } from '../config/realms';

// A synchronous accessor for the current realm config. The infrastructure
// provider caches the DB-loaded set and returns it here so use cases keep the
// synchronous access they had with the old module constant.
export interface RealmConfigSource {
  get(): RealmConfigSet;
}
