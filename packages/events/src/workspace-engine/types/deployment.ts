import type * as pb from "../gen/workspace_pb.js";
import type { WithSelector } from "./common.js";

export type Deployment = WithSelector<pb.Deployment, "resourceSelector">;
