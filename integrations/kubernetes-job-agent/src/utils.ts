import type { Operations } from "@ctrlplane/node-sdk";

export function omitNullUndefined(obj: object) {
  return Object.entries(obj).reduce<Record<string, string>>(
    (acc, [key, value]) => {
      if (value !== null && value !== undefined) acc[key] = value;
      return acc;
    },
    {},
  );
}

export type ScannerFunc = () => Promise<
  Operations["setTargetProvidersTargets"]["requestBody"]["content"]["application/json"]["targets"]
>;
