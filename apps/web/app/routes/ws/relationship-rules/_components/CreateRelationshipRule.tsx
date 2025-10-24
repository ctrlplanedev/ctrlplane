import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { useWorkspace } from "~/components/WorkspaceProvider";
import CelExpressionInput from "../../_components/CelExpiressionInput";

// Validation schema for relationship rule creation
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
  relationshipType: z
    .string()
    .min(1, { message: "Relationship type is required" })
    .max(100, {
      message: "Relationship type must be at most 100 characters long",
    }),
  fromType: z.enum(["deployment", "environment", "resource"]),
  fromSelectorCel: z.string().optional(),
  toType: z.enum(["deployment", "environment", "resource"]),
  toSelectorCel: z.string().optional(),
  matcherCel: z.string().min(1, { message: "Matcher is required" }),
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

type CreateRelationshipRuleProps = {
  onSuccess?: () => void;
};

export function CreateRelationshipRule({
  onSuccess,
}: CreateRelationshipRuleProps) {
  const { workspace } = useWorkspace();
  const utils = trpc.useUtils();

  const form = useForm<RelationshipRuleFormData>({
    resolver: zodResolver(relationshipRuleSchema),
    defaultValues: {
      name: "",
      reference: "",
      description: "",
      relationshipType: "",
      fromType: "resource",
      fromSelectorCel: "",
      toType: "resource",
      toSelectorCel: "",
      matcherCel: "",
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

  // Auto-generate reference from name
  const handleNameChange = (value: string) => {
    form.setValue("name", value);
    // Auto-generate reference from name (convert to lowercase, replace spaces/special chars with hyphens)
    const autoReference = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!form.formState.dirtyFields.reference) {
      form.setValue("reference", autoReference);
    }
  };

  const createRelationshipRuleMutation = trpc.relationships.create.useMutation({
    onSuccess: () => {
      toast.success("Relationship rule created successfully");
      form.reset();

      // Invalidate relationship rules list to refetch
      void utils.relationships.get.invalidate();

      onSuccess?.();
    },
    onError: (error: unknown) => {
      const message =
        error != null &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "Failed to create relationship rule";
      toast.error(message);
    },
  });

  const onSubmit = form.handleSubmit((data: RelationshipRuleFormData) => {
    // Transform metadata array to record<string, string>
    const metadataRecord = data.metadata.reduce(
      (acc, { key, value }) => {
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>,
    );

    createRelationshipRuleMutation.mutate({
      workspaceId: workspace.id,
      name: data.name,
      reference: data.reference,
      description: data.description,
      relationshipType: data.relationshipType,
      fromType: data.fromType,
      fromSelectorCel: data.fromSelectorCel ?? undefined,
      toType: data.toType,
      toSelectorCel: data.toSelectorCel ?? undefined,
      matcherCel: data.matcherCel,
      metadata: metadataRecord,
    });
  });

  const isSubmitting = createRelationshipRuleMutation.isPending;

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Basic Info Section */}
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
                      onChange={(e) => handleNameChange(e.target.value)}
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
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    A unique identifier for this rule (slug format)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="relationshipType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship Type</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="depends-on, related-to, etc."
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    The type of relationship (e.g., depends-on, related-to)
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

          {/* From Entity Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">From Entity</h3>

            <FormField
              control={form.control}
              name="fromType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select entity type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="resource">Resource</SelectItem>
                      <SelectItem value="deployment">Deployment</SelectItem>
                      <SelectItem value="environment">Environment</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The type of entity this relationship originates from
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fromSelectorCel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From Selector (Optional)</FormLabel>
                  <FormControl>
                    <div className="rounded-md border border-input p-2">
                      <CelExpressionInput
                        height="100px"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder='resource.kind == "KubernetesCluster" && resource.metadata.region == "us-east-1"'
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Filter which entities match the from side
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* To Entity Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">To Entity</h3>

            <FormField
              control={form.control}
              name="toType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To Type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select entity type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="resource">Resource</SelectItem>
                      <SelectItem value="deployment">Deployment</SelectItem>
                      <SelectItem value="environment">Environment</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The type of entity this relationship points to
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="toSelectorCel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To Selector (Optional)</FormLabel>
                  <FormControl>
                    <div className="rounded-md border border-input p-2">
                      <CelExpressionInput
                        height="100px"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder='deployment.name.startsWith("api-") && deployment.version == "v1.2.3"'
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Filter which entities match the to side
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Matcher Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Matcher</h3>

            <FormField
              control={form.control}
              name="matcherCel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CEL Matcher Expression</FormLabel>
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

          {/* Metadata Section */}
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

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Relationship Rule
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
