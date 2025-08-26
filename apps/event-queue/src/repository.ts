type Entity = { id: string };

interface Repository<T extends Entity> {
  get(id: string): T | null;
  getAll(): T[];
  create(entity: T): T;
  update(entity: T): T;
  delete(id: string): T | null;
  exists(id: string): boolean;
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
