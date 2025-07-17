import type { Policy } from "../../types";
import { ConcurrencyRule } from "../../rules/concurrency-rule.js";

export const getConcurrencyRule = (policy: Policy | null) => {
  if (policy?.concurrency == null) return [];

  return [
    new ConcurrencyRule({
      concurrency: policy.concurrency.concurrency,
      policyId: policy.id,
    }),
  ];
};
