import type * as pb from "../gen/workspace_pb.js";
import type { WithoutTypeName, WithSelector } from "./common.js";

export type PolicyRule = Omit<WithoutTypeName<pb.PolicyRule>, "rule"> & {
  anyApproval?: WithoutTypeName<pb.AnyApprovalRule>;
};
export type PolicyTarget = WithSelector<
  pb.PolicyTargetSelector,
  "deploymentSelector" | "environmentSelector" | "resourceSelector"
>;
export type Policy = Omit<WithoutTypeName<pb.Policy>, "selectors" | "rules"> & {
  selectors: PolicyTarget[];
  rules: PolicyRule[];
};
