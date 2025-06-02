"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconBulb } from "@tabler/icons-react";
import { z } from "zod";

import { Alert, AlertTitle } from "@ctrlplane/ui/alert";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";
import { VariableConfig } from "@ctrlplane/validators/variables";

import { api } from "~/trpc/react";
import {
  BooleanConfigFields,
  ConfigTypeSelector,
  NumberConfigFields,
  StringConfigFields,
} from "./ConfigFields";

const schema = z.object({
  key: z.string(),
  description: z.string(),
  config: VariableConfig,
});

export const CreateVariableDialog: React.FC<{
  deploymentId: string;
  children?: React.ReactNode;
}> = ({ children, deploymentId }) => {
  const [open, setOpen] = useState(false);
  const create = api.deployment.variable.create.useMutation();
  const router = useRouter();
  const form = useForm({
    schema,
    defaultValues: {
      description: "",
      config: { type: "string", inputType: "text" },
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await create.mutateAsync({ deploymentId, data: values });
    router.refresh();
    setOpen(false);
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>Add Variable</DialogTitle>
              <DialogDescription>
                <Alert variant="secondary">
                  <IconBulb className="h-5 w-5" />
                  <AlertTitle>Deployment variables</AlertTitle>
                  Variables in deployments make automation flexible and
                  reusable. They let you customize deployments with user inputs
                  and use environment-specific values without hardcoding. This
                  allows deployments to adapt to different scenarios without
                  changing their core logic.
                </Alert>
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="my-variable, MY_VARIABLE..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config"
              render={({ field: { value, onChange } }) => (
                <>
                  <FormItem>
                    <FormLabel>Input Display</FormLabel>
                    <FormControl>
                      <ConfigTypeSelector
                        value={value.type}
                        onChange={(type: string) => onChange({ type })}
                        exclude={["choice"]}
                      />
                    </FormControl>
                  </FormItem>

                  {value.type === "string" && (
                    <StringConfigFields
                      config={value}
                      updateConfig={(updates) =>
                        onChange({ ...value, ...updates })
                      }
                    />
                  )}

                  {value.type === "boolean" && (
                    <BooleanConfigFields
                      config={value}
                      updateConfig={(updates) =>
                        onChange({ ...value, ...updates })
                      }
                    />
                  )}

                  {value.type === "number" && (
                    <NumberConfigFields
                      config={value}
                      updateConfig={(updates) =>
                        onChange({ ...value, ...updates })
                      }
                    />
                  )}
                </>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
