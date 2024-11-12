"use client";

import type {
  SessionCreate,
  SessionResize,
} from "@ctrlplane/validators/session";
import React, { createContext, useContext, useState } from "react";
import useWebSocket from "react-use-websocket";
import { v4 as uuidv4 } from "uuid";

type SessionContextType = {
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  sessionIds: { sessionId: string; targetId: string }[];
  createSession: (targetId: string) => void;
  removeSession: (id: string) => void;
  resizeSession: (
    sessionId: string,
    targetId: string,
    cols: number,
    rows: number,
  ) => void;
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useTerminalSessions = () => {
  const context = useContext(SessionContext);
  if (!context)
    throw new Error("useSession must be used within a SessionProvider");

  return context;
};

const url = "/api/v1/target/proxy/controller";
export const TerminalSessionsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [sessionIds, setSessionIds] = useState<
    { sessionId: string; targetId: string }[]
  >([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { sendJsonMessage } = useWebSocket(url, {
    shouldReconnect: () => true,
  });

  const resizeSession = (
    sessionId: string,
    targetId: string,
    cols: number,
    rows: number,
  ) => {
    const resizePayload: SessionResize = {
      type: "session.resize",
      sessionId,
      targetId,
      cols,
      rows,
    };
    console.log(resizePayload);
    sendJsonMessage(resizePayload);
  };

  const createSession = (targetId: string) => {
    const sessionId = uuidv4();
    const sessionCreatePayload: SessionCreate = {
      type: "session.create",
      targetId,
      sessionId,
      cols: 80,
      rows: 24,
    };
    sendJsonMessage(sessionCreatePayload);
    setTimeout(() => {
      setSessionIds((prev) => [...prev, { sessionId, targetId }]);
    }, 500);
  };
  const removeSession = (id: string) => {
    setSessionIds((prev) => prev.filter((session) => session.sessionId !== id));
  };

  return (
    <SessionContext.Provider
      value={{
        sessionIds,
        createSession,
        removeSession,
        resizeSession,

        isDrawerOpen,
        setIsDrawerOpen,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};
