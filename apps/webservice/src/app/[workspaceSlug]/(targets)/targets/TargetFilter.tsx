import type { Filter } from "../../_components/filter/Filter";

export type TargetFilter = Filter<
  "name" | "kind" | "labels",
  string | Record<string, string>
>;
