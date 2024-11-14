import ms from "ms";

import { env } from "./config.js";
import { addSocket } from "./routing.js";
import { app } from "./server.js";

const server = addSocket(app).listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});

const onCloseSignal = () => {
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), ms("10s")).unref(); // Force shutdown after 10s
};

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
