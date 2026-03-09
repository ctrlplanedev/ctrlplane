import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import { parse } from "cel-js";

export const validResourceSelector = (
  selector?: WorkspaceEngine["schemas"]["Selector"] | null,
) => {
  if (selector == null) return true;
  if (!("cel" in selector)) return true;


  try {
    const cel = parse(selector.cel);

    return cel.isSuccess;
  } catch (error) {
    console.error(error);
    return false;
  }
};
