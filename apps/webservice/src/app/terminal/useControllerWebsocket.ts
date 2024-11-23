import type {
  SessionCreate,
  SessionResize,
} from "@ctrlplane/validators/session";
import { useCallback } from "react";
import useWebSocket from "react-use-websocket";
import { v4 as uuidv4 } from "uuid";

const url = "/api/v1/resources/proxy/controller";

export const useControllerWebsocket = () => {
  const { sendJsonMessage, readyState } = useWebSocket(url, {
    shouldReconnect: () => true,
  });

  const resizeSession = useCallback(
    (sessionId: string, targetId: string, cols: number, rows: number) => {
      const resizePayload: SessionResize = {
        type: "session.resize",
        sessionId,
        targetId,
        cols,
        rows,
      };
      sendJsonMessage(resizePayload);
    },
    [sendJsonMessage],
  );

  const createSession = useCallback(
    (targetId: string, id?: string) => {
      const sessionId = id ?? uuidv4();
      const sessionCreatePayload: SessionCreate = {
        type: "session.create",
        targetId,
        sessionId,
        cols: 80,
        rows: 24,
      };
      sendJsonMessage(sessionCreatePayload);
      return sessionCreatePayload;
    },
    [sendJsonMessage],
  );

  return { sendJsonMessage, resizeSession, createSession, readyState };
};
