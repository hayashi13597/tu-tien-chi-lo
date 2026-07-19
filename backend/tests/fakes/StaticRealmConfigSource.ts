import { RealmConfigSource } from '../../src/domain/ports/RealmConfigSource';
import { RealmConfigSet, defaultRealmConfigSet } from '../../src/domain/config/realms';

export class StaticRealmConfigSource implements RealmConfigSource {
  constructor(private readonly set: RealmConfigSet = defaultRealmConfigSet()) {}
  get(): RealmConfigSet {
    return this.set;
  }
}
