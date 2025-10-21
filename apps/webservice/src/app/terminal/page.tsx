import { Suspense } from "react";
import { IconPlus } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

import { CreateSessionDialog } from "./_components/CreateDialogSession";
import { LoadSessionFromParams } from "./_components/LoadSessionFromParams";
import { SessionTerminals } from "./_components/SessionTerminals";
import { TerminalSessionsProvider } from "./_components/TerminalSessionsProvider";
import { TerminalTabs } from "./_components/TerminalTabs";

export const metadata = {
  title: "Terminal | Ctrlplane",
  description:
    "Interactive terminal for managing Ctrlplane resources and deployments",
};

export default function TerminalPage() {
  return (
    <TerminalSessionsProvider>
      <Suspense fallback={null}>
        <LoadSessionFromParams />
      </Suspense>
      <div className="flex h-[100vh] flex-col">
        <div className="flex h-9 items-center border-b px-2">
          <TerminalTabs />
          <div className="flex-grow" />

          <CreateSessionDialog>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <IconPlus className="h-5 w-5 text-neutral-400" />
            </Button>
          </CreateSessionDialog>
        </div>
        <div className="mt-4 h-full w-full flex-grow">
          <SessionTerminals />
        </div>
      </div>
    </TerminalSessionsProvider>
  );
}
