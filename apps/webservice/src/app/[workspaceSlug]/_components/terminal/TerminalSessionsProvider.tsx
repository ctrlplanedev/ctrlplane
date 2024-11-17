"use client";

import type {
  SessionCreate,
  SessionResize,
} from "@ctrlplane/validators/session";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import useWebSocket from "react-use-websocket";
import { isPresent } from "ts-is-present";
import { v4 as uuidv4 } from "uuid";

import { api } from "~/trpc/react";

type SessionContextType = {
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
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

  const utils = api.useUtils();
  const targets = useMemo(
    () =>
      context.sessionIds
        .map((s) => utils.resource.byId.getData(s.targetId))
        .filter(isPresent),
    [context.sessionIds, utils.resource.byId],
  );

  return { targets, ...context };
};

const url = "/api/v1/resources/proxy/controller";
export const TerminalSessionsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [sessionIds, setSessionIds] = useState<
    { sessionId: string; targetId: string }[]
  >([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { sendJsonMessage } = useWebSocket(url, {
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
    (targetId: string) => {
      const sessionId = uuidv4();
      const sessionCreatePayload: SessionCreate = {
        type: "session.create",
        targetId,
        sessionId,
        cols: 80,
        rows: 24,
      };
      sendJsonMessage(sessionCreatePayload);
      window.requestAnimationFrame(() => {
        setSessionIds((prev) => [...prev, { sessionId, targetId }]);
        setActiveSessionId(sessionId);
      });
    },
    [sendJsonMessage, setSessionIds],
  );

  const removeSession = useCallback(
    (id: string) => {
      setSessionIds((prev) =>
        prev.filter((session) => session.sessionId !== id),
      );
      if (activeSessionId === id)
        setActiveSessionId(sessionIds[0]?.sessionId ?? null);
    },
    [activeSessionId, sessionIds],
  );

  return (
    <SessionContext.Provider
      value={{
        sessionIds,
        createSession,
        removeSession,
        resizeSession,
        activeSessionId,
        setActiveSessionId,
        isDrawerOpen,
        setIsDrawerOpen,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};
