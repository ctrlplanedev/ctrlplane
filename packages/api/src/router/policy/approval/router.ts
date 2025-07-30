import { createTRPCRouter } from "../../../trpc";
import { addRecord } from "./add-record";
import { byEnvironmentVersion } from "./approval-state";

export const policyApprovalRouter = createTRPCRouter({
  byEnvironmentVersion,
  addRecord,
});
