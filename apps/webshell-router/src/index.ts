/* eslint-disable @typescript-eslint/no-misused-promises */
import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { WebShellInstance } from "@ctrlplane/db/schema";

import { env } from "./config";
import { addSocket } from "./routing";
import { app } from "./server";

const disconnectAllInstances = async () =>
  db
    .update(WebShellInstance)
    .set({ isConnected: false })
    .where(eq(WebShellInstance.isConnected, true))
    .execute();

const server = addSocket(app).listen(env.PORT, async () => {
  await disconnectAllInstances();
  console.log(`Server is running on port ${env.PORT}`);
});

const onCloseSignal = async () => {
  await disconnectAllInstances();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after 10s
};

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
