import type * as pb from "../gen/workspace_pb.js";
import type { WithoutTypeName } from "./common.js";

export type LiteralValue = string | number | bigint | boolean | object | null;

export type ReferenceValue = WithoutTypeName<pb.ReferenceValue>;

export type SensitiveValue = WithoutTypeName<pb.SensitiveValue>;

export type Value = LiteralValue | ReferenceValue | SensitiveValue;
