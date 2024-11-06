import type { MessageEvent } from "ws";
import type { z } from "zod";

export const ifMessage = () => {
  const checks: ((event: MessageEvent) => void)[] = [];
  return {
    is<T>(schema: z.ZodSchema<T>, callback: (data: T) => void) {
      checks.push((e: MessageEvent) => {
        const result = schema.safeParse(e.data);
        if (result.success) {
          callback(result.data);
        }
      });
      return this;
    },
    handle() {
      return (event: MessageEvent) => {
        for (const check of checks) check(event);
      };
    },
  };
};
