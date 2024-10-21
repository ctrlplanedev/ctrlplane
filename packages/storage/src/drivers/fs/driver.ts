import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import etag from "etag";
import mimeTypes from "mime-types";

import type {
  ObjectMetadata,
  SignedURLOptions,
  StorageDriver,
} from "../../Storage.js";

// import type { StorageFile } from "../../StorageFile.js";

type FSDriverOptions = {
  location?: string;
  generateSignedURL?(key: string, options: SignedURLOptions): Promise<string>;
};

export class FSDriver implements StorageDriver {
  private _location: string;

  constructor(public readonly options: FSDriverOptions) {
    this._location = options.location ?? process.cwd();
  }

  async exists(key: string): Promise<boolean> {
    const location = path.join(this._location, key);
    try {
      const object = await fs.stat(location);
      return object.isFile();
    } catch (error: any) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }

  get(key: string): Promise<string> {
    return fs.readFile(path.join(this._location, key), "utf8");
  }

  getStream(key: string): Promise<Readable> {
    return new Promise<Readable>((resolve) => {
      const stream = createReadStream(path.join(this._location, key));
      resolve(stream);
    });
  }

  async delete(key: string): Promise<void> {
    const location = path.join(this._location, key);

    try {
      await fs.unlink(location);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  deleteAll(prefix: string): Promise<void> {
    const location = path.join(this._location, prefix);
    return fs.rm(location, { recursive: true, force: true });
  }

  async put(key: string, value: string): Promise<void> {
    const location = path.join(this._location, key);
    await fs.mkdir(path.dirname(location), { recursive: true });
    await fs.writeFile(location, value);
  }

  async putStream(key: string, value: Readable): Promise<void> {
    const location = path.join(this._location, key);
    await fs.mkdir(path.dirname(location), { recursive: true });
    await fs.writeFile(location, value);
  }

  // list(_: string): Promise<StorageFile[]> {
  //   throw new Error("Method not implemented.");
  // }

  getSignedUrl(key: string, opts: SignedURLOptions): Promise<string> {
    if (this.options.generateSignedURL == null)
      throw new Error("generateSignedURL is not defined");

    const location = path.join(this._location, key);
    return this.options.generateSignedURL(location, opts);
  }

  async getMetaData(key: string): Promise<ObjectMetadata> {
    const location = path.join(this._location, key);
    const stats = await fs.stat(location);

    if (stats.isDirectory()) throw new Error("File is a directory");

    return {
      contentLength: stats.size,
      contentType: mimeTypes.lookup(key) || undefined,
      etag: etag(stats),
      lastModified: stats.mtime,
    };
  }
}
