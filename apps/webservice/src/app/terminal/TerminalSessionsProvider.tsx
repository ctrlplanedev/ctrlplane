"use client";

import type { ReadyState } from "react-use-websocket";
import React, { createContext, useCallback, useContext, useState } from "react";

import { useControllerWebsocket } from "~/app/terminal/useControllerWebsocket";

type SessionContextType = {
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  isDrawerOpen: boolean;
  controllerReadyState: ReadyState;
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

export const TerminalSessionsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [sessionIds, setSessionIds] = useState<
    { sessionId: string; targetId: string }[]
  >([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { resizeSession, createSession, readyState } = useControllerWebsocket();

  const createTabSession = useCallback(
    (resourceId: string) => {
      const session = createSession(resourceId);
      console.log("session", session);
      window.requestAnimationFrame(() => {
        setSessionIds((prev) => [
          ...prev,
          { sessionId: session.sessionId, targetId: resourceId },
        ]);
        setActiveSessionId(session.sessionId);
      });
    },
    [createSession, setSessionIds],
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
        createSession: createTabSession,
        removeSession,
        resizeSession,
        activeSessionId,
        setActiveSessionId,
        isDrawerOpen,
        setIsDrawerOpen,
        controllerReadyState: readyState,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};
