import { z } from "zod";

export const workspaceInfoSchema = z.object({
  name: z
    .string()
    .min(1, "Workspace name is required")
    .max(100, "Workspace name must be less than 100 characters"),
  slug: z
    .string()
    .min(3, "Workspace slug must be at least 3 characters")
    .max(50, "Workspace slug must be less than 50 characters")
    .regex(
      /^[a-z0-9-]+$/,
      "Workspace slug can only contain lowercase letters, numbers, and hyphens",
    ),
});

export type WorkspaceInfoFormData = z.infer<typeof workspaceInfoSchema>;
