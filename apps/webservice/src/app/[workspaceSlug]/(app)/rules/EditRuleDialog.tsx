"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ctrlplane/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Switch } from "@ctrlplane/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";
import { Textarea } from "@ctrlplane/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@ctrlplane/ui/accordion";
import { Badge } from "@ctrlplane/ui/badge";

import { Rule, RuleConfiguration, RuleType } from "./mock-data";
import { SelectorsField } from "./SelectorsField";
import { TypeSpecificConfig } from "./TypeSpecificConfig";

interface EditRuleDialogProps {
  rule: Rule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper function to get configurations from a rule
const getRuleConfigurations = (rule: Rule): RuleConfiguration[] => {
  if (rule.configurations && rule.configurations.length > 0) {
    return rule.configurations;
  } else if (rule.type && rule.configuration) {
    return [{
      type: rule.type,
      enabled: rule.enabled,
      config: rule.configuration
    }];
  }
  return [];
};

// Get color class based on rule type
const getTypeColorClass = (type: RuleType): string => {
  switch (type) {
    case 'time-window':
      return 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200';
    case 'maintenance-window':
      return 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200';
    case 'gradual-rollout':
      return 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200';
    case 'rollout-ordering':
      return 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200';
    case 'rollout-pass-rate':
      return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200';
    case 'release-dependency':
      return 'bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200';
    default:
      return '';
  }
};

// Get soft background color class for headers
const getTypeBackgroundClass = (type: RuleType): string => {
  switch (type) {
    case 'time-window':
      return 'bg-blue-50 border-blue-200';
    case 'maintenance-window':
      return 'bg-amber-50 border-amber-200';
    case 'gradual-rollout':
      return 'bg-green-50 border-green-200';
    case 'rollout-ordering':
      return 'bg-purple-50 border-purple-200';
    case 'rollout-pass-rate':
      return 'bg-emerald-50 border-emerald-200';
    case 'release-dependency':
      return 'bg-rose-50 border-rose-200';
    default:
      return 'bg-slate-50 border-slate-200';
  }
};

// Get text color class based on rule type
const getTypeTextClass = (type: RuleType): string => {
  switch (type) {
    case 'time-window':
      return 'text-blue-700';
    case 'maintenance-window':
      return 'text-amber-700';
    case 'gradual-rollout':
      return 'text-green-700';
    case 'rollout-ordering':
      return 'text-purple-700';
    case 'rollout-pass-rate':
      return 'text-emerald-700';
    case 'release-dependency':
      return 'text-rose-700';
    default:
      return 'text-slate-700';
  }
};

// Get icon for rule type
const getRuleTypeIcon = (type: RuleType) => {
  switch (type) {
    case 'time-window':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'maintenance-window':
      return <Clock className="h-4 w-4 text-amber-500" />;
    case 'gradual-rollout':
      return <ArrowDownIcon className="h-4 w-4 text-green-500" />;
    case 'rollout-ordering':
      return <LayersIcon className="h-4 w-4 text-purple-500" />;
    case 'rollout-pass-rate':
      return <CheckIcon className="h-4 w-4 text-emerald-500" />;
    case 'release-dependency':
      return <CalendarIcon className="h-4 w-4 text-rose-500" />;
    default:
      return null;
  }
};

// Get human readable label for rule type
const getRuleTypeLabel = (type: RuleType) => {
  switch (type) {
    case 'time-window': 
      return 'Time Window';
    case 'maintenance-window': 
      return 'Maintenance Window';
    case 'gradual-rollout': 
      return 'Gradual Rollout';
    case 'rollout-ordering': 
      return 'Rollout Order';
    case 'rollout-pass-rate': 
      return 'Success Rate Required';
    case 'release-dependency': 
      return 'Release Dependency';
    default: 
      return type;
  }
};

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  description: z.string().optional(),
  priority: z.coerce.number().min(1).max(100),
  enabled: z.boolean(),
  selectors: z.array(
    z.object({
      type: z.enum(['metadata', 'name', 'tag', 'environment', 'deployment']),
      key: z.string().optional(),
      value: z.string().optional(),
      operator: z.enum(['equals', 'not-equals', 'contains', 'not-contains', 'starts-with', 'ends-with', 'regex']),
    })
  ).min(1, { message: "At least one selector is required" }),
  // For legacy single configuration support
  configuration: z.record(z.any()).optional(),
  type: z.enum([
    'maintenance-window', 
    'gradual-rollout', 
    'time-window', 
    'rollout-ordering', 
    'rollout-pass-rate',
    'release-dependency'
  ]).optional(),
  // For multiple configurations support
  configurations: z.array(
    z.object({
      type: z.enum([
        'maintenance-window', 
        'gradual-rollout', 
        'time-window', 
        'rollout-ordering', 
        'rollout-pass-rate',
        'release-dependency'
      ]),
      enabled: z.boolean(),
      config: z.record(z.any())
    })
  ).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function EditRuleDialog({ rule, open, onOpenChange }: EditRuleDialogProps) {
  const configurations = getRuleConfigurations(rule);
  const [selectedConfigIndex, setSelectedConfigIndex] = useState<number | null>(
    configurations.length > 0 ? 0 : null
  );
  
  // Initialize form based on rule structure (legacy or new)
  const getFormDefaultValues = () => {
    const values: FormValues = {
      name: rule.name,
      description: rule.description || "",
      priority: rule.priority,
      enabled: rule.enabled,
      selectors: rule.conditions.selectors || [],
    };
    
    // Handle both legacy and new configuration formats
    if (rule.configurations && rule.configurations.length > 0) {
      values.configurations = rule.configurations;
    } else if (rule.type && rule.configuration) {
      values.type = rule.type;
      values.configuration = rule.configuration;
    }
    
    return values;
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getFormDefaultValues(),
  });

  // Update form when rule changes
  useEffect(() => {
    if (rule) {
      form.reset(getFormDefaultValues());
      
      // Reset selected config index
      const configs = getRuleConfigurations(rule);
      setSelectedConfigIndex(configs.length > 0 ? 0 : null);
    }
  }, [rule, form]);

  const onSubmit = (values: FormValues) => {
    // Handle both configuration formats
    const updatedRule = {
      ...rule,
      name: values.name,
      description: values.description,
      priority: values.priority,
      enabled: values.enabled,
      conditions: {
        ...rule.conditions,
        selectors: values.selectors,
      },
    };
    
    // Apply either legacy or new configuration format based on what's in the form
    if (values.configurations && values.configurations.length > 0) {
      updatedRule.configurations = values.configurations;
      // Remove legacy fields if they exist
      delete updatedRule.type;
      delete updatedRule.configuration;
    } else if (values.type && values.configuration) {
      updatedRule.type = values.type;
      updatedRule.configuration = values.configuration;
      // Remove new format if it exists
      delete updatedRule.configurations;
    }
    
    console.log("Updated rule:", updatedRule);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Rule: {rule.name}</DialogTitle>
          <DialogDescription>
            Update the rule settings and configuration
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="basic">
              <TabsList className="mb-4">
                <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                <TabsTrigger value="selectors">Selectors</TabsTrigger>
                <TabsTrigger value="configuration">Configuration</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority (1-100)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={100} {...field} />
                      </FormControl>
                      <FormDescription>
                        Lower numbers mean higher priority
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Status</FormLabel>
                        <FormDescription>
                          Enable or disable this rule
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="selectors">
                <SelectorsField
                  control={form.control}
                  name="selectors"
                  targetType={rule.targetType}
                />
              </TabsContent>

              <TabsContent value="configuration">
                {(() => {
                  const configurations = getRuleConfigurations(rule);
                  
                  if (configurations.length === 0) {
                    return (
                      <div className="text-muted-foreground p-4 border border-dashed rounded-md text-center">
                        No configurations defined for this rule.
                      </div>
                    );
                  } else if (configurations.length === 1) {
                    // Legacy single type configuration
                    return (
                      <TypeSpecificConfig
                        control={form.control}
                        name="configuration"
                        ruleType={rule.type || configurations[0].type}
                        targetType={rule.targetType}
                      />
                    );
                  } else {
                    // Multiple configurations
                    return (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h3 className="text-sm font-medium">Multiple Configuration Types</h3>
                          <Badge variant="outline" className="px-2 border-primary text-primary font-medium">{configurations.length} Types</Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          This rule combines multiple configuration types. Each type can be individually enabled or disabled.
                        </p>
                        
                        <Accordion type="single" collapsible value={selectedConfigIndex?.toString()} 
                          onValueChange={(value) => setSelectedConfigIndex(value ? parseInt(value) : null)}>
                          {configurations.map((config, index) => (
                            <AccordionItem key={index} value={index.toString()} className="border rounded-md overflow-hidden mb-4">
                              <AccordionTrigger className={`hover:no-underline ${getTypeBackgroundClass(config.type)} hover:bg-white data-[state=open]:bg-white px-4`}>
                                <div className="flex items-center justify-between w-full pr-4">
                                  <div className="flex items-center gap-2">
                                    {getRuleTypeIcon(config.type)}
                                    <span className={`font-medium ${getTypeTextClass(config.type)}`}>
                                      {getRuleTypeLabel(config.type)}
                                    </span>
                                  </div>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="mt-4">
                                  <TypeSpecificConfig
                                    control={form.control}
                                    name={`configurations.${index}.config`}
                                    ruleType={config.type}
                                    targetType={rule.targetType}
                                  />
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    );
                  }
                })()}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}