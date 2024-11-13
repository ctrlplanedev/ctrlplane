import type WebSocket from "ws";
import { z } from "zod";

import { ifMessage } from "./controller/utils";

export const auditSessions = (socket: WebSocket) => {
  socket.on(
    "message",
    ifMessage()
      .is(z.any(), (data) => {
        console.log(data);
      })
      .handle(),
  );
};
