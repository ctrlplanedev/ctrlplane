/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import type { Session } from "@auth/express";

declare module "express-serve-static-core" {
  interface Request {
    session: Session | null;
  }
}
