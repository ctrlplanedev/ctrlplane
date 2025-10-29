import { router } from "../../trpc.js";
import { policies } from "./policies.js";
import { policyResults } from "./policy-results.js";
import { releaseTargets } from "./release-targets.js";

export const environmentVersionRouter = router({
  policyResults,
  policies,
  releaseTargets,
});
