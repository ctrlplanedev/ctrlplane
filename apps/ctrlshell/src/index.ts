import ms from "ms";

import { env } from "./config";
import { addSocket } from "./routing";
import { app } from "./server";

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
