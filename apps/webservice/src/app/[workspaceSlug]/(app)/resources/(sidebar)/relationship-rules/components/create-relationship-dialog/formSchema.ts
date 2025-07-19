import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";

import * as SCHEMA from "@ctrlplane/db/schema";

export const formSchema = SCHEMA.createResourceRelationshipRule.extend({
  metadataKeysMatches: z.array(
    z.object({
      sourceKey: z.string(),
      targetKey: z.string(),
    }),
  ),
  targetMetadataEquals: z.array(
    z.object({ value: z.string(), key: z.string() }),
  ),
  sourceMetadataEquals: z.array(
    z.object({ value: z.string(), key: z.string() }),
  ),
});

export type RuleForm = UseFormReturn<z.infer<typeof formSchema>>;
