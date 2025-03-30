import _ from "lodash";

import type { Policy } from "../types.js";

export const mergePolicies = (policies: Policy[]): Policy | null => {
  if (policies.length === 0) return null;
  if (policies.length === 1) return policies[0]!;
  return _.mergeWith(
    policies[0],
    ...policies.slice(1),
    (objValue: any, sourceValue: any) => {
      if (Array.isArray(objValue) && Array.isArray(sourceValue))
        return objValue.concat(sourceValue);
    },
  );
};
