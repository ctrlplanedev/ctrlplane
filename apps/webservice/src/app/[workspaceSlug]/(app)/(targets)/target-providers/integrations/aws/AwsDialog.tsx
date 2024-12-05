"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconBulb, IconCheck, IconCopy } from "@tabler/icons-react";
import { useFieldArray } from "react-hook-form";
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
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";

import { api } from "~/trpc/react";

export const createAwsSchema = z.object({
  name: z.string(),
  awsRoleArns: z.array(
    z.object({
      value: z
        .string()
        .regex(
          /^arn:aws:iam::[0-9]{12}:role\/[a-zA-Z0-9+=,.@\-_/]+$/,
          "Invalid AWS Role ARN format. Expected format: arn:aws:iam::<account-id>:role/<role-name>",
        ),
    }),
  ),
});

export const AwsDialog: React.FC<{
  workspace: Workspace;
  children: React.ReactNode;
}> = ({ children, workspace }) => {
  const form = useForm({
    schema: createAwsSchema,
    defaultValues: {
      name: "",
      awsRoleArns: [{ value: "" }],
    },
    mode: "onSubmit",
  });
  const { fields, append } = useFieldArray({
    name: "awsRoleArns",
    control: form.control,
  });

  const [isCopied, setIsCopied] = useState(false);
  const [, copy] = useCopyToClipboard();
  const handleCopy = () => {
    copy(workspace.awsRoleArn ?? "");
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 1000);
  };

  const router = useRouter();
  const utils = api.useUtils();
  const create = api.resource.provider.managed.aws.create.useMutation();
  const onSubmit = form.handleSubmit(async (data) => {
    await create.mutateAsync({
      ...data,
      workspaceId: workspace.id,
      config: {
        awsRoleArns: data.awsRoleArns.map((a) => a.value),
      },
    });
    await utils.resource.provider.byWorkspaceId.invalidate();
    router.refresh();
    router.push(`/${workspace.slug}/target-providers`);
  });
  return (
    <Dialog>
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
                  value={workspace.awsRoleArn ?? ""}
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
                        AWS Role ARNs
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="arn:aws:iam::<account-id>:role/<role-name>"
                          {...field}
                        />
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
                Add Role ARN
              </Button>
            </div>

            <DialogFooter>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
