import type * as pb from "../gen/workspace_pb.js";
import type { WithoutTypeName } from "./common.js";

export type DeploymentVariable = WithoutTypeName<pb.DeploymentVariable>;
export type DeploymentVariableValue =
  WithoutTypeName<pb.DeploymentVariableValue>;
export type DeploymentVersion = WithoutTypeName<pb.DeploymentVersion>;
