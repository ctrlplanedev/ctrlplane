export const convertToOapiSelector = <
  T extends Record<string, any> | null | undefined,
>(
  selector: T,
): { json: Record<string, unknown> } | undefined =>
  selector ? { json: selector } : undefined;
