import { router } from "../../trpc.js";
import { policies } from "./policies.js";
import { policyResults } from "./policy-results.js";

export const environmentVersionRouter = router({
  policyResults,
  policies,
});
