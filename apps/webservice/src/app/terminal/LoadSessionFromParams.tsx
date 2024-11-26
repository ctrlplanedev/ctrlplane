"use client";

import type React from "react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ReadyState } from "react-use-websocket";

import { useTerminalSessions } from "./TerminalSessionsProvider";

export const LoadSessionFromParams: React.FC = () => {
  const { createSession, controllerReadyState } = useTerminalSessions();

  const params = useSearchParams();
  useEffect(() => {
    if (controllerReadyState !== ReadyState.OPEN) return;
    const resourceIds = params.getAll("resource");
    setTimeout(() => {
      for (const resourceId of resourceIds) createSession(resourceId);
    }, 500);
  }, [params, controllerReadyState, createSession]);

  return null;
};
