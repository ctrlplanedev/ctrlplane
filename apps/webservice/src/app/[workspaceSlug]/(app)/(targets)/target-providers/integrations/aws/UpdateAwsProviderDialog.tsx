"use client";

import type { ResourceProviderAws } from "@ctrlplane/db/schema";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconBulb, IconCheck, IconCopy, IconX } from "@tabler/icons-react";
import { useCopyToClipboard } from "react-use";
import { z } from "zod";

import { cn } from "@ctrlplane/ui";
import { Alert, AlertDescription, AlertTitle } from "@ctrlplane/ui/alert";
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
  useFieldArray,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";

import { api } from "~/trpc/react";
import { createAwsSchema } from "./AwsDialog";

const formSchema = createAwsSchema.and(
  z.object({
    repeatSeconds: z.number(),
  }),
);

export const UpdateAwsProviderDialog: React.FC<{
  providerId: string;
  name: string;
  awsConfig: ResourceProviderAws | null;
  onClose?: () => void;
  children: React.ReactNode;
}> = ({ providerId, awsConfig, name, onClose, children }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const form = useForm({
    schema: formSchema,
    defaultValues: {
      name,
      ...awsConfig,
      awsRoleArns: awsConfig?.awsRoleArns.map((a) => ({ value: a })) ?? [],
      repeatSeconds: 0,
    },
    mode: "onChange",
  });

  const utils = api.useUtils();
  const update = api.resource.provider.managed.aws.update.useMutation();
  const onSubmit = form.handleSubmit(async (data) => {
    if (workspace.data == null) return;
    await update.mutateAsync({
      ...data,
      resourceProviderId: providerId,
      config: {
        awsRoleArns: data.awsRoleArns.map((a) => a.value),
      },
      repeatSeconds: data.repeatSeconds === 0 ? null : data.repeatSeconds,
    });
    await utils.resource.provider.byWorkspaceId.invalidate();
    setOpen(false);
    onClose?.();
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "awsRoleArns",
  });

  const [open, setOpen] = useState(false);

  const [isCopied, setIsCopied] = useState(false);
  const [, copy] = useCopyToClipboard();
  const handleCopy = () => {
    copy(workspace.data?.awsRoleArn ?? "");
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 1000);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          form.reset();
          onClose?.();
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className={"max-h-screen overflow-y-scroll"}>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>Configure AWS Provider</DialogTitle>
              <DialogDescription>
                AWS provider allows you to configure and import EKS clusters
                from your AWS accounts.
              </DialogDescription>

              <Alert variant="secondary">
                <IconBulb className="h-5 w-5" />
                <AlertTitle>AWS Provider</AlertTitle>
                <AlertDescription>
                  To utilize the AWS provider, it's necessary to grant our role
                  access to your AWS accounts and set up the required
                  permissions. For detailed instructions, please refer to our{" "}
                  <Link
                    href="https://docs.ctrlplane.dev/integrations/aws/compute-scanner"
                    target="_blank"
                    className="underline"
                  >
                    documentation
                  </Link>
                  .
                </AlertDescription>
              </Alert>
            </DialogHeader>

            <div className="space-y-2">
              <Label>AWS Role</Label>
              <div className="relative flex items-center">
                <Input
                  value={workspace.data?.awsRoleArn ?? ""}
                  className="disabled:cursor-default"
                  disabled
                />
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={handleCopy}
                  className="absolute right-2 h-4 w-4 bg-neutral-950 backdrop-blur-sm transition-all hover:bg-neutral-950 focus-visible:ring-0"
                >
                  {isCopied ? (
                    <IconCheck className="h-4 w-4 bg-neutral-950 text-green-500" />
                  ) : (
                    <IconCopy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              {fields.map((field, index) => (
                <FormField
                  control={form.control}
                  key={field.id}
                  name={`awsRoleArns.${index}.value`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn(index !== 0 && "sr-only")}>
                        AWS Account Role Arns
                      </FormLabel>
                      <FormControl>
                        <div className="relative flex items-center">
                          <Input
                            placeholder="arn:aws:iam::<account-id>:role/<role-name>"
                            {...field}
                          />

                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 h-4 w-4 bg-neutral-950 hover:bg-neutral-950"
                              onClick={() => remove(index)}
                            >
                              <IconX className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => append({ value: "" })}
              >
                Add Account
              </Button>
            </div>

            <FormField
              control={form.control}
              name="repeatSeconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scan Frequency (seconds)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  form.formState.isSubmitting || !form.formState.isDirty
                }
              >
                Update
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
