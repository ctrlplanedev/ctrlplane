import type { Readable } from "node:stream";
import { z } from "zod";

import type { StorageFile } from "./StorageFile";

export const FileMetadata = z.object({
  name: z.string(),
  size: z.number(),
  contentType: z.string().optional(),
  lastModified: z.date().optional(),
});

export type FileMetadata = z.infer<typeof FileMetadata>;

/**
 * Options accepted during the creation of a signed URL.
 */
export type SignedURLOptions = {
  expiresIn?: number;
  contentType?: string;
  contentDisposition?: string;
} & Record<string, any>;

/**
 * The metadata of an object that can be fetched using the "getMetadata" method.
 */
export type ObjectMetadata = {
  contentType?: string;
  contentLength: number;
  etag: string;
  lastModified: Date;
};

export interface StorageDriver {
  exists(key: string): Promise<boolean>;

  get(key: string): Promise<string>;
  getStream(key: string): Promise<Readable>;

  delete(key: string): Promise<void>;
  deleteAll(prefix: string): Promise<void>;

  put(key: string, value: string): Promise<void>;
  putStream(key: string, value: Readable): Promise<void>;

  list(prefix: string): Promise<StorageFile[]>;

  getMetaData(key: string): Promise<ObjectMetadata>;
  getSignedUrl(path: string, opts: SignedURLOptions): Promise<string>;
}
