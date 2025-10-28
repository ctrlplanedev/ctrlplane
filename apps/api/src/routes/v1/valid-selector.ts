import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

export const validResourceSelector = async (
  selector?: WorkspaceEngine["schemas"]["Selector"] | null,
) => {
  if (selector == null) return true;
  if (!("cel" in selector)) return true;

  const cel = selector.cel;

  try {
    const validate = await getClientFor("any").POST(
      "/v1/validate/resource-selector",
      {
        body: {
          resourceSelector: {
            cel,
          },
        },
      },
    );

    return validate.data?.valid ?? false;
  } catch (error) {
    console.error(error);
    return false;
  }
};
