export const convertToOapiSelector = <
  T extends Record<string, any> | null | undefined,
>(
  selector: T,
): { json: Record<string, never> } | undefined =>
  selector ? { json: selector as Record<string, never> } : undefined;
