import { z } from "zod";

export const identifiable = z.object({
  version: z.string(),
  kind: z.string(),
});

export type Identifiable = z.infer<typeof identifiable>;

export const isIdentifiable = (obj: object): obj is Identifiable => {
  return identifiable.safeParse(obj).success;
};

export const getIdentifiableSchemaParseError = (
  obj: object,
): z.ZodError | undefined => {
  return identifiable.safeParse(obj).error;
};

/**
 * getSchemaParseError will return a ZodError if the object has expected kind and version
 * @param obj incoming object to have it's schema validated, if identifiable based on its kind and version
 * @param matcher impl to check the object's kind and version
 * @param schema schema to validate the object against
 * @returns ZodError if the object is has expected kind and version
 */
export const getSchemaParseError = <S extends z.ZodSchema>(
  obj: object,
  matcher: (identifiable: Identifiable) => boolean,
  schema: S,
): z.ZodError | undefined => {
  if (isIdentifiable(obj) && matcher(obj)) {
    // If the object is identifiable and matches the kind and version, validate it against the schema
    const parseResult = schema.safeParse(obj);
    return parseResult.error;
  }
  return undefined;
};
