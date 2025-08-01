export interface EntityStore<E> {
  loadEntities(entities: E[]): void;
  upsertEntity(entity: E): void;
  removeEntity(entityId: string): void;
  removeEntities(entityIds: string[]): void;
  getEntity(entityId: string): E | undefined;
  getEntities(entityIds: string[]): E[];
  getAllEntities(): E[];
}
