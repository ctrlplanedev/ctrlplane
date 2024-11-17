"use client";

import type { Terminal } from "@xterm/xterm";
import React, { useRef, useState } from "react";
import { IconLoader2, IconPlus, IconX } from "@tabler/icons-react";
import { createPortal } from "react-dom";
import useWebSocket, { ReadyState } from "react-use-websocket";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";

import { SocketTerminal } from "~/components/xterm/SessionTerminal";
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

  const { resizeSession } = useTerminalSessions();
  const [terminalContent, setTerminalContent] = useState("");
  const { getWebSocket, readyState } = useWebSocket(
    `/api/v1/resources/proxy/session/${sessionId}`,
    {
      shouldReconnect: () => true,
      onMessage: (e) => {
        const decoder = new TextDecoder();
        const text: string =
          e.data instanceof ArrayBuffer
            ? decoder.decode(e.data)
            : // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              e.data.toString();
        setTerminalContent((prev) => {
          // eslint-disable-next-line no-control-regex
          const newContent = prev + text.replace(/\x1B\[[0-9;]*m/g, "");
          return newContent.slice(-1000);
        });
      },
    },
  );

  const promptInput = useRef<HTMLInputElement>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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

  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (prompt.length === 0) {
      terminalRef.current?.focus();
      return;
    }
    setIsLoading(true);

    const res = await fetch("/api/v1/ai/command", {
      method: "POST",
      body: JSON.stringify({ prompt, history: terminalContent }),
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
    <div className="relative h-full" onKeyDown={handleKeyDown}>
      {readyState === ReadyState.OPEN && (
        <>
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
          {!showPrompt && (
            <div className="text-[0.02em] text-neutral-500">
              ⌘K to generate a command
            </div>
          )}
        </>
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
  const {
    targets,
    sessionIds,
    removeSession,
    activeSessionId,
    setActiveSessionId,
    setIsDrawerOpen,
  } = useTerminalSessions();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center border-b">
        {sessionIds.map((s) => (
          <div
            key={s.sessionId}
            onClick={() => setActiveSessionId(s.sessionId)}
            className={cn(
              "flex cursor-pointer items-center gap-2 border-b-2 p-2 pt-4 text-xs",
              activeSessionId === s.sessionId
                ? "border-blue-300 text-blue-300"
                : "border-transparent text-neutral-400",
            )}
          >
            <span>
              {targets.find((t) => t.id === s.targetId)?.name ?? s.targetId}
            </span>

            <button
              type="button"
              aria-label={`Close ${s.targetId} terminal session`}
              className="rounded-full text-xs text-blue-300 hover:text-neutral-300"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeSession(s.sessionId);
              }}
            >
              <IconX className="h-3 w-3" />
            </button>
          </div>
        ))}

        <div className="flex-grow" />

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

      <div className="mt-4 h-full w-full flex-grow">
        {sessionIds.map((s) => (
          <div
            key={s.sessionId}
            className={cn(
              "h-full px-4",
              activeSessionId !== s.sessionId && "hidden",
            )}
          >
            <SessionTerminal {...s} />
          </div>
        ))}
      </div>
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
