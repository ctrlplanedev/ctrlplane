import type WebSocket from "ws";
import { z } from "zod";

import { sessionInput, sessionOutput } from "./payloads";
import { ifMessage } from "./utils";

export const auditSessions = (socket: WebSocket) => {
  socket.addListener(
    "message",
    ifMessage()
      .is(z.union([sessionOutput, sessionInput]), (data) => {
        const timeStamp = new Date().toISOString();
        console.log(`${timeStamp} Output: ${data.data}`);
      })
      .handle(),
  );
};
