export interface SelectorEngine<E, S> {
  loadEntities(entities: E[]): Promise<void> | void;
  upsertEntity(entity: E): Promise<void> | void;
  removeEntities(entityIds: string[]): Promise<void> | void;

  loadSelectors(selectors: S[]): Promise<void> | void;
  upsertSelector(selector: S): Promise<void> | void;
  removeSelectors(ids: string[]): Promise<void> | void;

  getMatchesForEntity(entity: E): Promise<S[]> | S[];
  getMatchesForSelector(selector: S): Promise<E[]> | E[];
}
