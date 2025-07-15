import { z } from "zod";

export const releaseTargetModuleConfig = z.object({
  name: z.string().nullable(),
  releaseTargetId: z.string().uuid(),
});

export type ReleaseTargetModuleConfig = z.infer<
  typeof releaseTargetModuleConfig
>;

export const getIsValidConfig = (config: any) => {
  const parsedConfig = releaseTargetModuleConfig.safeParse(config);
  return parsedConfig.success;
};
