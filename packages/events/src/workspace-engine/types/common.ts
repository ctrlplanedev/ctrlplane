// Remove the typescript-specific $typeName field from the protobuf objects
// go complains about the $typeName field being unknown
export type WithoutTypeName<T> = Omit<T, "$typeName">;

export type Selector = { json?: Record<string, any> };
export type WithSelector<T, K extends keyof T> = WithoutTypeName<Omit<T, K>> &
  Partial<Record<K, Selector>>;

export const wrapSelector = <T extends Record<string, any> | null | undefined>(
  selector: T,
): Selector | undefined => (selector == null ? undefined : { json: selector });
