import { router } from "../../trpc.js";
import { policyResults } from "./policy-results.js";

export const environmentVersionRouter = router({
  policyResults,
});
