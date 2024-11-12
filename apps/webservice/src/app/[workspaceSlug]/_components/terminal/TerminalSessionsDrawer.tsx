"use client";

import React, { Fragment } from "react";
import { IconCircleFilled, IconPlus, IconX } from "@tabler/icons-react";
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
  const target = api.target.byId.useQuery(targetId);
  const { resizeSession } = useTerminalSessions();
  const { getWebSocket, readyState } = useWebSocket(
    `/api/v1/target/proxy/session/${sessionId}`,
    { shouldReconnect: () => true },
  );
  const connectionStatus = {
    [ReadyState.CONNECTING]: "Connecting",
    [ReadyState.OPEN]: "Open",
    [ReadyState.CLOSING]: "Closing",
    [ReadyState.CLOSED]: "Closed",
    [ReadyState.UNINSTANTIATED]: "Uninstantiated",
  }[readyState];

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {target.data?.name} ({targetId} / {sessionId})
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
            getWebSocket={getWebSocket}
            readyState={readyState}
            sessionId={sessionId}
            onResize={({ cols, rows }) =>
              resizeSession(sessionId, targetId, cols, rows)
            }
          />
        </div>
      )}
    </>
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

export const TerminalDrawer: React.FC = () => {
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
