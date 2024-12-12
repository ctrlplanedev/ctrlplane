import type { UseFormReturn } from "react-hook-form";
import ms from "ms";
import { z } from "zod";

import * as SCHEMA from "@ctrlplane/db/schema";

const isValidDuration = (str: string) => !isNaN(ms(str));

export const policyFormSchema = SCHEMA.updateEnvironmentPolicy
  .omit({
    rolloutDuration: true,
  })
  .extend({
    rolloutDuration: z.string().refine(isValidDuration, {
      message: "Invalid duration pattern",
    }),
  });

export type PolicyFormSchema = UseFormReturn<z.infer<typeof policyFormSchema>>;
