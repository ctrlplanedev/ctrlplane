"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";
import { Separator } from "@ctrlplane/ui/separator";

import { api } from "~/trpc/react";
import { OverviewContent } from "./OverviewContent";

const param = "variable_set_id";

export const useVariableSetDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const variableSetId = params.get(param);

  const setVariableSetId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id === null) {
      url.searchParams.delete(param);
    } else {
      url.searchParams.set(param, id);
    }
    router.replace(url.toString());
  };

  const removeVariableSetId = () => setVariableSetId(null);

  return { variableSetId, setVariableSetId, removeVariableSetId };
};

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
        <div className="border-b p-6">
          <DrawerTitle>{variableSet?.name}</DrawerTitle>
        </div>

        <div className="w-full">
          {variableSet != null && environments != null && (
            <OverviewContent
              variableSet={variableSet}
              environments={environments}
            />
          )}
          <Separator />
        </div>
      </DrawerContent>
    </Drawer>
  );
};
