"use client";

import React from "react";

import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";

import { api } from "~/trpc/react";
import { OverviewContent } from "./OverviewContent";
import { useVariableSetDrawer } from "./useVariableSetDrawer";
import { VariableSetActionsDropdown } from "./VariableSetActionsDropdown";

export const VariableSetDrawer: React.FC = () => {
  const { variableSetId, removeVariableSetId } = useVariableSetDrawer();
  const isOpen = variableSetId != null && variableSetId != "";
  const setIsOpen = removeVariableSetId;
  const variableSetQ = api.variableSet.byId.useQuery(variableSetId ?? "", {
    enabled: isOpen,
  });
  const variableSet = variableSetQ.data;

  const systemQ = api.system.byId.useQuery(variableSet?.systemId ?? "", {
    enabled: isOpen,
  });
  const system = systemQ.data;
  const environments = system?.environments;

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="left-auto right-0 top-0 mt-0 h-screen w-1/3 overflow-auto rounded-none focus-visible:outline-none"
      >
        <div className="flex items-center gap-2 border-b px-6 py-4">
          <DrawerTitle>{variableSet?.name}</DrawerTitle>
          {variableSet != null && (
            <VariableSetActionsDropdown variableSet={variableSet} />
          )}
        </div>

        <div className="w-full">
          {variableSet != null && environments != null && (
            <OverviewContent
              variableSet={variableSet}
              environments={environments}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
