import type * as pb from "../gen/workspace_pb.js";
import type { WithoutTypeName } from "./common.js";
import type { Value } from "./variables.js";

export type Resource = Omit<WithoutTypeName<pb.Resource>, "variables"> & {
  variables: Record<string, Value>;
};
