export function omitNullUndefined(
  obj: Record<string, any>,
): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      if (value !== null && value !== undefined) acc[key] = String(value);
      return acc;
    },
    {},
  );
}
