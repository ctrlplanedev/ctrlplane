import { z } from "zod";

export const identifiable = z.object({
    version: z.string(),
    kind: z.string(),
});

export type Identifiable = z.infer<typeof identifiable>;

export const isIdentifiable = (
    obj: object,
): obj is Identifiable => {
    return identifiable.safeParse(obj).success;
};

export const isResourceAPI = <S extends z.ZodSchema>(
    obj: object,
    matcher: (identifiable: Identifiable) => boolean,
    schema: S,
): obj is z.infer<S> => {
    if (isIdentifiable(obj) && matcher(obj)) {
        // If the object is identifiable and matches the kind and version, validate it against the schema
        const parseResult = schema.safeParse(obj);
        if (parseResult.success) {
            return true;
        }
        // If validation fails, log and throw the error
        console.error("Validation failed:", parseResult.error);
        throw parseResult.error;
    }
    return false;
};
