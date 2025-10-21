import type { Session } from "@ctrlplane/auth";

declare module "express-serve-static-core" {
  interface Request {
    session: Session | null;
  }
}
