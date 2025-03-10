"use client";

import React from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { createPortal } from "react-dom";

import { Button } from "@ctrlplane/ui/button";

import { CreateSessionDialog } from "~/app/terminal/_components/CreateDialogSession";
import { SessionTerminals } from "~/app/terminal/_components/SessionTerminals";
import { useTerminalSessions } from "~/app/terminal/_components/TerminalSessionsProvider";
import { TerminalTabs } from "~/app/terminal/_components/TerminalTabs";
import { useResizableHeight } from "~/app/terminal/_components/useResizableHeight";

const TerminalSessionsContent: React.FC = () => {
  const { setIsDrawerOpen } = useTerminalSessions();

  return (
    <div className="flex h-[100vh] flex-col">
      <div className="g-full flex h-9 items-center border-b">
        <TerminalTabs />

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
        <SessionTerminals />
      </div>
    </div>
  );
};

const MIN_HEIGHT = 200;
const DEFAULT_HEIGHT = 300;

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
