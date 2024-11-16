"use client";

import type { Terminal } from "@xterm/xterm";
import React, { Fragment, useEffect, useRef, useState } from "react";
import {
  IconCircleFilled,
  IconLoader2,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import { createPortal } from "react-dom";
import useWebSocket, { ReadyState } from "react-use-websocket";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@ctrlplane/ui/resizable";

import { SocketTerminal } from "~/components/xterm/SessionTerminal";
import { api } from "~/trpc/react";
import { CreateSessionDialog } from "./CreateDialogSession";
import { useTerminalSessions } from "./TerminalSessionsProvider";
import { useResizableHeight } from "./useResizableHeight";

const MIN_HEIGHT = 200;
const DEFAULT_HEIGHT = 300;

const SessionTerminal: React.FC<{ sessionId: string; targetId: string }> = ({
  sessionId,
  targetId,
}) => {
  const terminalRef = useRef<Terminal | null>(null);
  const target = api.resource.byId.useQuery(targetId);
  const { resizeSession } = useTerminalSessions();
  const { getWebSocket, readyState } = useWebSocket(
    `/api/v1/resources/proxy/session/${sessionId}`,
    { shouldReconnect: () => true },
  );
  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  const promptInput = useRef<HTMLInputElement>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setShowPrompt(false);
      window.requestAnimationFrame(() => {
        terminalRef.current?.focus();
      });
      return;
    }

    const isCommandK = (e.ctrlKey || e.metaKey) && e.key === "k";
    if (isCommandK) {
      e.preventDefault();
      setShowPrompt(!showPrompt);
      if (!showPrompt)
        window.requestAnimationFrame(() => {
          promptInput.current?.focus();
        });
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLoading(true);
    const res = await fetch("/api/v1/ai/command", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
    const { text } = await res.json();

    const ws = getWebSocket();
    if (ws && "send" in ws) {
      const ctrlUSequence = new Uint8Array([0x15]); // Ctrl+U to delete line
      ws.send(ctrlUSequence);
      ws.send(text);
      setIsLoading(false);
      setPrompt("");
    }
  };

  return (
    <div className="relative h-full">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {target.data?.name}
        <div className="flex items-center gap-1 rounded-md border px-1 pr-2">
          <span
            className={cn({
              "text-yellow-500": readyState === ReadyState.CONNECTING,
              "text-green-500": readyState === ReadyState.OPEN,
              "text-red-500":
                readyState === ReadyState.CLOSED ||
                readyState === ReadyState.UNINSTANTIATED,
              "text-orange-500": readyState === ReadyState.CLOSING,
            })}
          >
            <IconCircleFilled className="h-2 w-2" />
          </span>
          <span className="text-xs italic">{connectionStatus}</span>
        </div>
      </div>

      {readyState === ReadyState.OPEN && (
        <div className="h-[calc(100%-30px)]">
          <SocketTerminal
            terminalRef={terminalRef}
            getWebSocket={getWebSocket}
            readyState={readyState}
            sessionId={sessionId}
            onResize={({ cols, rows }) =>
              resizeSession(sessionId, targetId, cols, rows)
            }
          />
        </div>
      )}

      <div
        className={`absolute bottom-0 left-0 right-0 z-40 p-2 ${!showPrompt ? "hidden" : ""}`}
      >
        <div className="relative w-[550px] rounded-lg border border-neutral-700 bg-black/20 drop-shadow-2xl backdrop-blur-sm">
          <button
            className="absolute right-2 top-2 hover:text-white"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowPrompt(false);
            }}
          >
            <IconX className="h-3 w-3 text-neutral-500" type="button" />
          </button>
          <form onSubmit={handleSubmit}>
            <div className="m-2 flex items-center justify-between">
              <input
                ref={promptInput}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Command instructions..."
                className="block w-full rounded-md border-none bg-transparent p-1 text-xs outline-none placeholder:text-neutral-400"
              />
            </div>

            <div className="m-2 flex items-center">
              {prompt.length > 0 ? (
                <Button className="m-0 h-4 px-1 text-[0.02em]" type="submit">
                  Submit
                </Button>
              ) : (
                <div className="h-4 text-[0.02em] text-neutral-500">
                  Esc to close
                </div>
              )}

              {isLoading && (
                <IconLoader2 className="h-4 w-4 animate-spin text-blue-200" />
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const TerminalSessionsContent: React.FC = () => {
  const { sessionIds, setIsDrawerOpen } = useTerminalSessions();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center justify-end px-2">
        <CreateSessionDialog>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <IconPlus className="h-5 w-5 text-neutral-400" />
          </Button>
        </CreateSessionDialog>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsDrawerOpen(false)}
        >
          <IconX className="h-5 w-5 text-neutral-400" />
        </Button>
      </div>

      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        {sessionIds.map((s, idx) => (
          <Fragment key={s.sessionId}>
            {idx !== 0 && <ResizableHandle className="bg-neutral-700" />}
            <ResizablePanel key={s.sessionId} className="px-4">
              <SessionTerminal {...s} />
            </ResizablePanel>
          </Fragment>
        ))}
      </ResizablePanelGroup>
    </div>
  );
};

const TerminalDrawer: React.FC = () => {
  const { height, handleMouseDown } = useResizableHeight(
    DEFAULT_HEIGHT,
    MIN_HEIGHT,
  );
  const { isDrawerOpen } = useTerminalSessions();

  return createPortal(
    <div
      className={`fixed bottom-0 left-0 right-0 z-30 bg-black drop-shadow-2xl ${
        isDrawerOpen ? "" : "hidden"
      }`}
      style={{ height: `${height}px` }}
    >
      <div
        className="absolute left-0 right-0 top-0 h-1 cursor-ns-resize bg-neutral-800 hover:bg-neutral-700"
        onMouseDown={handleMouseDown}
      />

      <TerminalSessionsContent />
    </div>,
    document.body,
  );
};

export default TerminalDrawer;
