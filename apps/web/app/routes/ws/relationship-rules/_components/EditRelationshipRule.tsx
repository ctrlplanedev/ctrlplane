import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { useWorkspace } from "~/components/WorkspaceProvider";
import CelExpressionInput from "../../_components/CelExpiressionInput";

const relationshipRuleSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Name is required" })
    .max(255, { message: "Name must be at most 255 characters long" }),
  reference: z
    .string()
    .min(1, { message: "Reference is required" })
    .regex(/^[a-z0-9-_]+$/, {
      message:
        "Reference must contain only lowercase letters, numbers, hyphens, and underscores",
    }),
  description: z
    .string()
    .max(500, { message: "Description must be at most 500 characters long" })
    .optional(),
  cel: z.string().min(1, { message: "CEL expression is required" }),
  metadata: z
    .array(
      z.object({
        key: z.string().min(1, { message: "Key is required" }),
        value: z.string(),
      }),
    )
    .default([]),
});

type RelationshipRuleFormData = z.infer<typeof relationshipRuleSchema>;

type EditRelationshipRuleProps = {
  ruleId: string;
};

export function EditRelationshipRule({ ruleId }: EditRelationshipRuleProps) {
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data: relationshipRules, isLoading } =
    trpc.relationships.list.useQuery({
      workspaceId: workspace.id,
      limit: 200,
      offset: 0,
    });

  const rule = relationshipRules?.find((r) => r.id === ruleId);

  const form = useForm<RelationshipRuleFormData>({
    resolver: zodResolver(relationshipRuleSchema),
    defaultValues: {
      name: "",
      reference: "",
      description: "",
      cel: "",
      metadata: [],
    },
  });

  const {
    fields: metadataFields,
    append: appendMetadata,
    remove: removeMetadata,
  } = useFieldArray({
    control: form.control,
    name: "metadata",
  });

  useEffect(() => {
    if (rule) {
      const metadata: Record<string, string> = rule.metadata ?? {};
      const metadataArray = Object.entries(metadata).map(([key, value]) => ({
        key,
        value,
      }));

      form.reset({
        name: rule.name,
        reference: rule.reference,
        description: rule.description ?? "",
        cel: rule.cel,
        metadata: metadataArray,
      });
    }
  }, [rule, form]);

  const updateRelationshipRuleMutation = trpc.relationships.update.useMutation({
    onSuccess: () => {
      toast.success("Relationship rule updated successfully");

      void utils.relationships.list.invalidate();

      navigate(`/${workspace.slug}/relationship-rules`);
    },
    onError: (error: unknown) => {
      const message =
        error != null &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "Failed to update relationship rule";
      toast.error(message);
    },
  });

  const onSubmit = form.handleSubmit((data: RelationshipRuleFormData) => {
    const metadataRecord = data.metadata.reduce(
      (acc, { key, value }) => {
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    updateRelationshipRuleMutation.mutate({
      id: ruleId,
      workspaceId: workspace.id,
      name: data.name,
      reference: data.reference,
      description: data.description,
      cel: data.cel,
      metadata: metadataRecord,
    });
  });

  const isSubmitting = updateRelationshipRuleMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <h3 className="text-lg font-semibold">Relationship rule not found</h3>
        <p className="text-sm text-muted-foreground">
          The relationship rule with ID "{ruleId}" could not be found.
        </p>
        <Button
          onClick={() => navigate(`/${workspace.slug}/relationship-rules`)}
        >
          Back to Rules
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Name this relationship rule"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for this relationship rule
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="unique-reference-key"
                      {...field}
                      disabled
                    />
                  </FormControl>
                  <FormDescription>
                    A unique identifier for this rule (cannot be changed)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this rule does"
                      {...field}
                      disabled={isSubmitting}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">CEL Expression</h3>

            <FormField
              control={form.control}
              name="cel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CEL Expression</FormLabel>
                  <FormControl>
                    <div className="rounded-md border border-input p-2">
                      <CelExpressionInput
                        height="120px"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="from.metadata.region == to.config.targetRegion"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Define how entities are matched together
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Metadata</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendMetadata({ key: "", value: "" })}
                disabled={isSubmitting}
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                Add Metadata
              </Button>
            </div>

            {metadataFields.length > 0 && (
              <div className="space-y-3">
                {metadataFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <FormField
                      control={form.control}
                      name={`metadata.${index}.key`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              placeholder="Key"
                              {...field}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`metadata.${index}.value`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              placeholder="Value"
                              {...field}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeMetadata(index)}
                      disabled={isSubmitting}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/${workspace.slug}/relationship-rules`)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update Relationship Rule
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
