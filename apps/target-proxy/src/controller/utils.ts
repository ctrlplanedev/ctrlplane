import type { RawData } from "ws";
import type { z } from "zod";

export const ifMessage = () => {
  const checks: ((event: RawData, isBinary: boolean) => void)[] = [];
  return {
    is<T>(schema: z.ZodSchema<T>, callback: (data: T) => Promise<void> | void) {
      checks.push((e: RawData | MessageEvent) => {
        const stringData = JSON.stringify(e);
        let data = JSON.parse(stringData);

        if (data.type === "Buffer")
          data = JSON.parse(Buffer.from(data.data).toString());

        const result = schema.safeParse(data);
        if (result.success) {
          const maybePromise = callback(result.data);
          if (maybePromise instanceof Promise)
            maybePromise.catch(console.error);
        }
      });
      return this;
    },
    handle() {
      return (event: RawData, isBinary: boolean) => {
        for (const check of checks) check(event, isBinary);
      };
    },
  };
};
