import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "./config.js";

export const { POST, GET } = toNextJsHandler(auth);
