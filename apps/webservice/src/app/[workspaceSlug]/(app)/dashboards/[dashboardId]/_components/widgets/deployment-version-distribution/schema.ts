import { z } from "zod";

export const widgetSchema = z.object({
  name: z.string(),
  deploymentId: z.string().uuid(),
  environmentIds: z.array(z.string().uuid()).optional(),
});

export type WidgetSchema = z.infer<typeof widgetSchema>;

export const getIsValidConfig = (config: any) => {
  const parsedConfig = widgetSchema.safeParse(config);
  return parsedConfig.success;
};
