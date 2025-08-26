type Entity = { id: string };

export interface Repository<T extends Entity> {
  get(id: string): Promise<T | null> | T | null;
  getAll(): Promise<T[]> | T[];
  create(entity: T): Promise<T> | T;
  update(entity: T): Promise<T> | T;
  delete(id: string): Promise<T | null> | T | null;
  exists(id: string): Promise<boolean> | boolean;
}

export class RepositoryWithID<T extends Entity> implements Repository<T> {
  private entities: Record<string, T> = {};

  get(id: string): T | null {
    return this.entities[id] ?? null;
  }
  getAll(): T[] {
    return Object.values(this.entities);
  }
  create(entity: T): T {
    this.entities[entity.id] = entity;
    return entity;
  }
  update(entity: T): T {
    const existing = this.entities[entity.id] ?? {};
    this.entities[entity.id] = { ...existing, ...entity };
    return this.entities[entity.id]!;
  }
  delete(id: string): T | null {
    const entity = this.entities[id];
    if (entity == null) return null;
    delete this.entities[id];
    return entity;
  }
  exists(id: string): boolean {
    return this.entities[id] != null;
  }
}
