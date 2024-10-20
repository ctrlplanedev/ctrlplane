import { basename } from "node:path";

import type { StorageDriver } from "./Storage.js";

export class StorageFile {
  name: string;
  constructor(
    private readonly storage: StorageDriver,
    private readonly key: string,
  ) {
    this.name = basename(key);
  }

  exists() {
    return this.storage.exists(this.key);
  }

  async get() {
    return this.storage.get(this.key);
  }

  async getStream() {
    return this.storage.getStream(this.key);
  }

  async delete() {
    return this.storage.delete(this.key);
  }

  async put(value: string) {
    return this.storage.put(this.key, value);
  }
}
