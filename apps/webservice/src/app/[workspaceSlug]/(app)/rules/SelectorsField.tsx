"use client";

import { useState } from "react";
import { PlusIcon, X } from "lucide-react";
import { Control, useFieldArray } from "react-hook-form";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ctrlplane/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

import { RuleTargetType, Selector } from "./mock-data";

interface SelectorsFieldProps {
  control: Control<any>;
  name: string;
  targetType: RuleTargetType;
}

export function SelectorsField({ control, name, targetType }: SelectorsFieldProps) {
  const [activeTab, setActiveTab] = useState<'deployment' | 'environment'>(
    targetType === 'environment' ? 'environment' : 'deployment'
  );
  
  // For backward compatibility use the original name for single target types
  const fieldName = targetType === 'both' 
    ? (activeTab === 'deployment' ? `${name.replace('selectors', 'conditions')}.deploymentSelectors` : `${name.replace('selectors', 'conditions')}.environmentSelectors`)
    : name;
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: fieldName,
  });

  // Get deployment selectors field array if both types
  const deploymentSelectors = targetType === 'both' 
    ? useFieldArray({
      control,
      name: `${name.replace('selectors', 'conditions')}.deploymentSelectors`,
    })
    : null;

  // Get environment selectors field array if both types
  const environmentSelectors = targetType === 'both' 
    ? useFieldArray({
      control,
      name: `${name.replace('selectors', 'conditions')}.environmentSelectors`,
    })
    : null;

  const handleAddSelector = () => {
    if (targetType === 'both') {
      if (activeTab === 'deployment') {
        deploymentSelectors?.append({
          type: 'metadata',
          key: '',
          value: '',
          operator: 'equals',
          appliesTo: 'deployment',
        });
      } else {
        environmentSelectors?.append({
          type: 'environment', 
          value: '',
          operator: 'equals',
          appliesTo: 'environment',
        });
      }
    } else {
      append({
        type: targetType === 'deployment' ? 'metadata' : 'environment',
        key: '',
        value: '',
        operator: 'equals',
      });
    }
  };

  const getFields = () => {
    if (targetType === 'both') {
      return activeTab === 'deployment' 
        ? deploymentSelectors?.fields || []
        : environmentSelectors?.fields || [];
    }
    return fields;
  };

  const handleRemove = (index: number) => {
    if (targetType === 'both') {
      if (activeTab === 'deployment') {
        deploymentSelectors?.remove(index);
      } else {
        environmentSelectors?.remove(index);
      }
    } else {
      remove(index);
    }
  };

  return (
    <div className="space-y-4">
      {targetType === 'both' ? (
        <>
          <Tabs
            defaultValue="deployment"
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'deployment' | 'environment')}
          >
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="deployment">Deployment Selectors</TabsTrigger>
                <TabsTrigger value="environment">Environment Selectors</TabsTrigger>
              </TabsList>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSelector}
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add {activeTab === 'deployment' ? 'Deployment' : 'Environment'} Selector
              </Button>
            </div>
            
            <TabsContent value="deployment">
              <FormDescription>
                Define which deployments this rule applies to
              </FormDescription>
              
              {renderSelectorFields(
                getFields(), 
                `${name.replace('selectors', 'conditions')}.deploymentSelectors`,
                handleRemove,
                control,
                'deployment',
                activeTab
              )}
            </TabsContent>
            
            <TabsContent value="environment">
              <FormDescription>
                Define which environments this rule applies to
              </FormDescription>
              
              {renderSelectorFields(
                getFields(), 
                `${name.replace('selectors', 'conditions')}.environmentSelectors`,
                handleRemove,
                control,
                'environment',
                activeTab
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <FormLabel className="text-base">Target Selectors</FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSelector}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Selector
            </Button>
          </div>
          
          <FormDescription>
            Define which {targetType === 'deployment' ? 'deployments' : 'environments'} this rule applies to
          </FormDescription>
          
          {renderSelectorFields(fields, name, remove, control, targetType, undefined)}
        </>
      )}
    </div>
  );
}

function renderSelectorFields(
  fields: any[], 
  fieldName: string, 
  removeHandler: (index: number) => void, 
  control: Control<any>,
  targetType: RuleTargetType | 'deployment' | 'environment',
  activeTab?: 'deployment' | 'environment'
) {
  if (fields.length === 0) {
    return (
      <div className="text-center p-4 border border-dashed rounded-md text-muted-foreground">
        No selectors defined. Add at least one selector to specify which {targetType}s this rule applies to.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <div key={field.id} className="flex flex-col gap-4 p-4 border rounded-md relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={() => removeHandler(index)}
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="flex gap-2 items-center mb-2">
            <Badge variant="outline">Selector {index + 1}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={control}
              name={`${fieldName}.${index}.type`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {targetType === 'deployment' || (activeTab === 'deployment') ? (
                        <>
                          <SelectItem value="metadata">Metadata</SelectItem>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="tag">Tag</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="environment">Environment Name</SelectItem>
                          <SelectItem value="metadata">Metadata</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name={`${fieldName}.${index}.operator`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Operator</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select operator" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="not-equals">Not Equals</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="not-contains">Does Not Contain</SelectItem>
                      <SelectItem value="starts-with">Starts With</SelectItem>
                      <SelectItem value="ends-with">Ends With</SelectItem>
                      <SelectItem value="regex">Regex Match</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Conditionally render key input for metadata type */}
            {fields[index].type === 'metadata' && (
              <FormField
                control={control}
                name={`${fieldName}.${index}.key`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key</FormLabel>
                    <FormControl>
                      <Input placeholder="metadata.key" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={control}
              name={`${fieldName}.${index}.value`}
              render={({ field }) => (
                <FormItem className={fields[index].type === 'metadata' ? "md:col-span-3" : "md:col-span-1"}>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input placeholder="Value to match" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Add appliesTo field for 'both' target type */}
            {activeTab && (
              <FormField
                control={control}
                name={`${fieldName}.${index}.appliesTo`}
                render={({ field }) => (
                  <FormItem className="hidden"> {/* Hidden since it's set based on active tab */}
                    <FormControl>
                      <Input 
                        type="hidden" 
                        {...field} 
                        value={activeTab} 
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}