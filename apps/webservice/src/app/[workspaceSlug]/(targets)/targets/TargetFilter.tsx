import type { ComparisonCondition } from "@ctrlplane/validators/targets";

import type { Filter } from "../../_components/filter/Filter";

export type TargetFilter = Filter<
  "name" | "kind" | "metadata",
  string | Record<string, string> | ComparisonCondition
>;
