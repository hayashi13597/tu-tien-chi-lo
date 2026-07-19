// Port for invalidating the cached realm config after an admin write, so the
// presentation layer can trigger a reload without depending on the concrete
// infrastructure provider. The provider implements this alongside RealmConfigSource.
export interface RealmConfigReloader {
  reload(): Promise<void>;
}
