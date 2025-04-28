"use client";

import React, { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

import { DirectVariableForm } from "./DirectVariableForm";
import { ReferenceVariableForm } from "./ReferenceVariableForm";

type CreateResourceVariableDialogProps = {
  references: string[];
  resourceId: string;
  existingKeys: string[];
  children: React.ReactNode;
};

export const CreateResourceVariableDialog: React.FC<
  CreateResourceVariableDialogProps
> = ({ resourceId, existingKeys, children, references }) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"direct" | "reference">("direct");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Resource Variable</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "direct" | "reference")}
        >
          <TabsList>
            <TabsTrigger value="direct">Direct</TabsTrigger>
            <TabsTrigger value="reference">Reference</TabsTrigger>
          </TabsList>

          <TabsContent value="direct">
            <DirectVariableForm
              resourceId={resourceId}
              existingKeys={existingKeys}
              onSuccess={() => setOpen(false)}
            />
          </TabsContent>
          <TabsContent value="reference">
            <ReferenceVariableForm
              references={references}
              resourceId={resourceId}
              existingKeys={existingKeys}
              onSuccess={() => setOpen(false)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
