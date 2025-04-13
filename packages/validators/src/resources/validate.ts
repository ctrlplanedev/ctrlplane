import type { ZodError } from "zod";

import { getCloudVpcV1SchemaParserError } from "./cloud-v1.js";
import { getKubernetesClusterAPIV1SchemaParseError } from "./kubernetes-v1.js";
import { getIdentifiableSchemaParseError } from "./util.js";
import { getVmV1SchemaParseError } from "./vm-v1.js";

export const anySchemaError = (obj: object): ZodError | undefined => {
  return (
    getIdentifiableSchemaParseError(obj) ??
    getCloudVpcV1SchemaParserError(obj) ??
    getKubernetesClusterAPIV1SchemaParseError(obj) ??
    getVmV1SchemaParseError(obj)
  );
};

interface ValidatedObjects<T> {
  valid: T[];
  errors: ZodError[];
}

export const partitionForSchemaErrors = <T extends object>(
  objs: T[],
): ValidatedObjects<T> => {
  const errors: ZodError[] = [];
  const valid: T[] = [];

  for (const obj of objs) {
    const error = anySchemaError(obj);
    if (error) {
      errors.push(error);
    } else {
      valid.push(obj);
    }
  }

  return { valid, errors };
};
