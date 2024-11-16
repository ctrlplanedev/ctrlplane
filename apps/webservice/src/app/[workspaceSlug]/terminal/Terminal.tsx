"use client";

import type { Terminal } from "@xterm/xterm";
import React, { useEffect, useRef } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

import { useSessionTerminal } from "~/components/xterm/SessionTerminal";

export const SessionTerminal: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  console.log(sessionId);
  const { getWebSocket, readyState } = useWebSocket(
    `/api/v1/resources/proxy/session/${sessionId}`,
  );

  const terminalRef = useRef<Terminal | null>(null);
  const { divRef, fitAddon } = useSessionTerminal(
    terminalRef,
    getWebSocket,
    readyState,
  );

  useEffect(() => {
    if (readyState !== ReadyState.OPEN) return;
    if (terminalRef.current == null) return;
    terminalRef.current.focus();
    fitAddon.fit();
  }, [getWebSocket, terminalRef, fitAddon, readyState]);

  return (
    <div>
      <div className="h-full w-full">
        <div ref={divRef} className="h-full w-full" />
      </div>
    </div>
  );
};
