"use client";

import { IconX } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";

import { api } from "~/trpc/react";
import { useTerminalSessions } from "./TerminalSessionsProvider";

export const TerminalTab: React.FC<{
  resourceId: string;
  sessionId: string;
}> = ({ resourceId, sessionId }) => {
  const { removeSession, activeSessionId, setActiveSessionId } =
    useTerminalSessions();
  const resource = api.resource.byId.useQuery(resourceId);
  return (
    <div
      key={sessionId}
      onClick={() => setActiveSessionId(sessionId)}
      className={cn(
        "flex cursor-pointer items-center gap-2 border-b-2 p-2 pt-4 text-xs",
        activeSessionId === sessionId
          ? "border-blue-300 text-blue-300"
          : "border-transparent text-neutral-400",
      )}
    >
      <span>{resource.data?.name ?? resourceId}</span>

      <button
        type="button"
        aria-label={`Close ${resourceId} terminal session`}
        className="rounded-full text-xs text-blue-300 hover:text-neutral-300"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          removeSession(sessionId);
        }}
      >
        <IconX className="h-3 w-3" />
      </button>
    </div>
  );
};

export const TerminalTabs: React.FC = () => {
  const { sessionIds } = useTerminalSessions();
  return (
    <>
      {sessionIds.map((s) => (
        <TerminalTab key={s.sessionId} {...s} />
      ))}
    </>
  );
};
