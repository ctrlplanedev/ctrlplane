import type { Bucket } from "@google-cloud/storage";
import type { Readable } from "stream";
import { Storage as GoogleStorage } from "@google-cloud/storage";
import ms from "ms";

import type {
  ObjectMetadata,
  SignedURLOptions,
  StorageDriver,
} from "../../Storage.js";
import type { StorageFile } from "../../StorageFile.js";

type GCSDriverBaseOptions = {
  bucket: string;
  storage?: GoogleStorage;
};

export class GCSStorageDriver implements StorageDriver {
  private _storage: GoogleStorage;

  constructor(public readonly options: GCSDriverBaseOptions) {
    this._storage = options.storage ?? new GoogleStorage();
  }

  get bucket(): Bucket {
    return this._storage.bucket(this.options.bucket);
  }

  async exists(key: string): Promise<boolean> {
    const [response] = await this.bucket.file(key).exists();
    return response;
  }

  async get(key: string): Promise<string> {
    const response = await this.bucket.file(key).download();
    return response[0].toString("utf-8");
  }

  getStream(key: string): Promise<Readable> {
    return new Promise<Readable>((resolve) => {
      const stream = this.bucket.file(key).createReadStream();
      resolve(stream);
    });
  }

  async delete(key: string): Promise<void> {
    await this.bucket.file(key).delete();
  }

  async deleteAll(prefix: string): Promise<void> {
    const [files] = await this.bucket.getFiles({ prefix });
    await Promise.all(files.map((file) => file.delete()));
  }

  async put(key: string, value: string): Promise<void> {
    await this.bucket.file(key).save(value);
  }

  async putStream(key: string, value: Readable): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const writeStream = this.bucket.file(key).createWriteStream();
      value
        .pipe(writeStream)
        .on("finish", () => resolve())
        .on("error", (err) => reject(err));
    });
  }

  list(_: string): Promise<StorageFile[]> {
    throw new Error("Not implemented");
  }

  async getMetaData(key: string): Promise<ObjectMetadata> {
    const [metadata] = await this.bucket.file(key).getMetadata();
    return {
      contentLength:
        typeof metadata.size === "number"
          ? metadata.size
          : parseInt(metadata.size ?? "0"),
      contentType: metadata.contentType,
      etag: metadata.etag ?? "",
      lastModified: new Date(metadata.updated ?? ""),
    };
  }

  async getSignedUrl(path: string, opts: SignedURLOptions): Promise<string> {
    const expires = new Date();
    const m = opts.expiresIn ?? ms("30m");
    expires.setSeconds(new Date().getMilliseconds() + m);
    const [url] = await this.bucket.file(path).getSignedUrl({
      action: opts.action,
      expires,
      contentType: opts.contentType,
    });
    return url;
  }
}
