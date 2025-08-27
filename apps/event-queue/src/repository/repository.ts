type Entity = { id: string };

export interface Repository<T extends Entity> {
  get(id: string): Promise<T | null> | T | null;
  getAll(): Promise<T[]> | T[];
  create(entity: T): Promise<T> | T;
  update(entity: T): Promise<T> | T;
  delete(id: string): Promise<T | null> | T | null;
  exists(id: string): Promise<boolean> | boolean;
}
