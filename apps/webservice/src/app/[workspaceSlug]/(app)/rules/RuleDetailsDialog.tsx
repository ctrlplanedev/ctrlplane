"use client";

import { Clock, CalendarIcon, Target, ArrowDownIcon, Layers, Link, CheckCircle2, CheckIcon, XIcon } from "lucide-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ctrlplane/ui/dialog";
import { Separator } from "@ctrlplane/ui/separator";
import { Switch } from "@ctrlplane/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

import { Rule, RuleType, RuleConfiguration, Selector } from "./mock-data";

interface RuleDetailsDialogProps {
  rule: Rule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RuleDetailsDialog({ rule, open, onOpenChange }: RuleDetailsDialogProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Function to get configurations from a rule (legacy or new format)
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

  const getRuleTypeIcon = (type: RuleType) => {
    switch (type) {
      case 'time-window':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'maintenance-window':
        return <Clock className="h-5 w-5 text-amber-500" />;
      case 'gradual-rollout':
        return <ArrowDownIcon className="h-5 w-5 text-green-500" />;
      case 'rollout-ordering':
        return <Layers className="h-5 w-5 text-purple-500" />;
      case 'rollout-pass-rate':
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'release-dependency':
        return <Link className="h-5 w-5 text-rose-500" />;
      default:
        return <Target className="h-5 w-5" />;
    }
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

  const getOperatorLabel = (operator: string) => {
    switch (operator) {
      case 'equals': return 'equals';
      case 'not-equals': return 'does not equal';
      case 'contains': return 'contains';
      case 'not-contains': return 'does not contain';
      case 'starts-with': return 'starts with';
      case 'ends-with': return 'ends with';
      case 'regex': return 'matches regex';
      default: return operator;
    }
  };

  const renderSelector = (selector: Selector) => {
    switch (selector.type) {
      case 'metadata':
        return (
          <div className="flex gap-1 items-center">
            <span className="font-medium">Metadata:</span>
            <span className="text-muted-foreground">{selector.key}</span>
            <span>{getOperatorLabel(selector.operator)}</span>
            <span className="font-medium">"{selector.value}"</span>
          </div>
        );
      case 'name':
        return (
          <div className="flex gap-1 items-center">
            <span className="font-medium">Name</span>
            <span>{getOperatorLabel(selector.operator)}</span>
            <span className="font-medium">"{selector.value}"</span>
          </div>
        );
      case 'tag':
        return (
          <div className="flex gap-1 items-center">
            <span className="font-medium">Tag</span>
            <span>{getOperatorLabel(selector.operator)}</span>
            <span className="font-medium">"{selector.value}"</span>
          </div>
        );
      case 'environment':
        return (
          <div className="flex gap-1 items-center">
            <span className="font-medium">Environment</span>
            <span>{getOperatorLabel(selector.operator)}</span>
            <span className="font-medium">"{selector.value}"</span>
          </div>
        );
      case 'deployment':
        return (
          <div className="flex gap-1 items-center">
            <span className="font-medium">Deployment</span>
            <span>{getOperatorLabel(selector.operator)}</span>
            <span className="font-medium">"{selector.value}"</span>
          </div>
        );
      default:
        return null;
    }
  };

  const renderConfigDetails = (type: RuleType, config: Record<string, any>, enabled: boolean) => {
    switch (type) {
      case 'time-window':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Timezone</h3>
              <p>{config.timezone}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium">Windows</h3>
              <div className="space-y-2 mt-2">
                {config.windows.map((window: any, index: number) => (
                  <div key={index} className="p-3 bg-muted/50 rounded-md">
                    <div>
                      <span className="font-medium">Days: </span>
                      {window.days.join(', ')}
                    </div>
                    <div>
                      <span className="font-medium">Hours: </span>
                      {window.startTime} - {window.endTime}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      
      case 'maintenance-window':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium">Recurrence</h3>
                <p>{config.recurrence}</p>
              </div>
              {config.recurrence === "MONTHLY" && (
                <div>
                  <h3 className="text-sm font-medium">Day of Month</h3>
                  <p>{config.dayOfMonth}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium">Start Time</h3>
                <p>{config.startTime} ({config.timezone})</p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Duration</h3>
                <p>{config.duration} minutes</p>
              </div>
            </div>
            {config.notification && (
              <div>
                <h3 className="text-sm font-medium">Notifications</h3>
                <p>Sent {config.notification.beforeMinutes.join(', ')} minutes before</p>
              </div>
            )}
          </div>
        );
      
      case 'gradual-rollout':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Rollout Stages</h3>
              <div className="space-y-2 mt-2">
                {config.stages.map((stage: any, index: number) => (
                  <div key={index} className="p-3 bg-muted/50 rounded-md flex justify-between items-center">
                    <div className="font-medium">{stage.percentage}%</div>
                    <div className="text-muted-foreground">
                      {stage.durationMinutes > 0
                        ? `Wait ${stage.durationMinutes} minutes before next stage`
                        : 'Final stage'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium">Rollback Thresholds</h3>
              <div className="grid grid-cols-2 gap-4 mt-2">
                {config.rollbackThreshold?.errorRate && (
                  <div className="p-3 bg-muted/50 rounded-md">
                    <div className="text-xs text-muted-foreground">Error Rate</div>
                    <div className="font-medium">{config.rollbackThreshold.errorRate}%</div>
                  </div>
                )}
                {config.rollbackThreshold?.responseTime && (
                  <div className="p-3 bg-muted/50 rounded-md">
                    <div className="text-xs text-muted-foreground">Response Time</div>
                    <div className="font-medium">{config.rollbackThreshold.responseTime}ms</div>
                  </div>
                )}
                {config.rollbackThreshold?.cpuUtilization && (
                  <div className="p-3 bg-muted/50 rounded-md">
                    <div className="text-xs text-muted-foreground">CPU Utilization</div>
                    <div className="font-medium">{config.rollbackThreshold.cpuUtilization}%</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'rollout-ordering':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Deployment Order</h3>
              <div className="space-y-2 mt-2">
                {config.order.map((item: any, index: number) => (
                  <div key={index} className="p-3 bg-muted/50 rounded-md flex justify-between items-center">
                    <div className="font-medium">{index + 1}. {item.name}</div>
                    <div className="text-muted-foreground">
                      {item.delayAfterMinutes > 0
                        ? `Wait ${item.delayAfterMinutes} minutes before next`
                        : 'No delay'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span>Fail Fast</span>
              <Switch checked={config.failFast} disabled />
            </div>
          </div>
        );

      case 'rollout-pass-rate':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium">Metric</h3>
                <p>{config.metricName}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Threshold</h3>
                <p>{config.threshold}%</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium">Observation Window</h3>
                <p>{config.observationWindowMinutes} minutes</p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Minimum Sample Size</h3>
                <p>{config.minimumSampleSize} requests</p>
              </div>
            </div>
          </div>
        );

      case 'release-dependency':
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Dependencies</h3>
              <div className="space-y-2 mt-2">
                {config.dependencies.map((dep: any, index: number) => (
                  <div key={index} className="p-3 bg-muted/50 rounded-md">
                    <div className="font-medium">{dep.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Version: {dep.requiredVersion}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                <span>Wait for Stability</span>
                <Switch checked={config.waitForStability} disabled />
              </div>
              <div className="p-3 bg-muted/50 rounded-md">
                <div className="text-xs text-muted-foreground">Timeout</div>
                <div className="font-medium">{config.timeoutMinutes} minutes</div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-muted-foreground">
            No specific configuration for this rule type.
          </div>
        );
    }
  };

  const renderTypeSpecificDetails = () => {
    const configurations = getRuleConfigurations(rule);
    
    if (configurations.length === 0) {
      return (
        <div className="text-muted-foreground p-4 border border-dashed rounded-md text-center">
          No configurations found for this rule.
        </div>
      );
    } else if (configurations.length === 1) {
      // Legacy single configuration format
      return renderConfigDetails(
        configurations[0].type, 
        configurations[0].config, 
        configurations[0].enabled
      );
    } else {
      // Multiple configurations
      return (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground mb-4">
            This rule has {configurations.length} different configuration types. Each type provides different
            constraints or requirements that must be satisfied for the deployment to proceed.
          </p>
          
          {configurations.map((config, index) => (
            <div key={index} className="border rounded-md overflow-hidden">
              <div className={`p-3 flex items-center justify-between ${getTypeBackgroundClass(config.type)} border-b`}>
                <div className="flex items-center gap-2">
                  {getRuleTypeIcon(config.type)}
                  <span className={`font-medium ${getTypeTextClass(config.type)}`}>{getRuleTypeLabel(config.type)}</span>
                </div>
              </div>
              <div className="p-4">
                {renderConfigDetails(config.type, config.config, config.enabled)}
              </div>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {getRuleTypeIcon(rule.type)}
            <DialogTitle>{rule.name}</DialogTitle>
          </div>
          {rule.description && (
            <DialogDescription>
              {rule.description}
            </DialogDescription>
          )}
        </DialogHeader>
        
        <Tabs defaultValue="overview">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="selectors">Selectors</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-medium mb-1">Rule Type</h3>
                {(() => {
                  const configurations = getRuleConfigurations(rule);
                  
                  if (configurations.length === 0) {
                    return <div className="text-muted-foreground">No configuration</div>;
                  } else if (configurations.length === 1) {
                    // Single rule type (legacy format)
                    return (
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline"
                          className={getTypeColorClass(configurations[0].type)}
                        >
                          {getRuleTypeIcon(configurations[0].type)}
                          <span className="ml-1">{getRuleTypeLabel(configurations[0].type)}</span>
                        </Badge>
                      </div>
                    );
                  } else {
                    // Multiple rule types
                    return (
                      <div className="flex flex-wrap gap-2">
                        {configurations.map((config, idx) => (
                          <Badge 
                            key={idx}
                            variant="outline"
                            className={getTypeColorClass(config.type)}
                          >
                            {getRuleTypeIcon(config.type)}
                            <span className="ml-1">{getRuleTypeLabel(config.type)}</span>
                          </Badge>
                        ))}
                      </div>
                    );
                  }
                })()}
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-medium mb-1">Target</h3>
                {rule.targetType === 'both' ? (
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant="secondary">Deployment</Badge>
                    <span className="text-sm">+</span>
                    <Badge variant="outline">Environment</Badge>
                  </div>
                ) : (
                  <Badge variant={rule.targetType === 'deployment' ? 'secondary' : 'outline'}>
                    {rule.targetType === 'deployment' ? 'Deployment' : 'Environment'}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Scope</h3>
              
              {(() => {
                // Check if we have any selectors
                const hasDeploymentSelectors = rule.conditions.deploymentSelectors && rule.conditions.deploymentSelectors.length > 0;
                const hasEnvironmentSelectors = rule.conditions.environmentSelectors && rule.conditions.environmentSelectors.length > 0;
                const hasLegacySelectors = rule.conditions.selectors && rule.conditions.selectors.length > 0;
                const hasNoSelectors = !hasDeploymentSelectors && !hasEnvironmentSelectors && !hasLegacySelectors;
                
                if (rule.targetType === 'both') {
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="secondary" 
                          className="capitalize"
                        >
                          {hasDeploymentSelectors 
                            ? `${rule.conditions.deploymentSelectors?.length} Deployment Selector${(rule.conditions.deploymentSelectors?.length || 0) !== 1 ? 's' : ''}`
                            : 'All Deployments'}
                        </Badge>
                        <span>×</span>
                        <Badge 
                          variant="outline" 
                          className="capitalize"
                        >
                          {hasEnvironmentSelectors 
                            ? `${rule.conditions.environmentSelectors?.length} Environment Selector${(rule.conditions.environmentSelectors?.length || 0) !== 1 ? 's' : ''}`
                            : 'All Environments'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        This rule applies to combinations of specific deployments and environments, creating a matrix of applicability.
                      </p>
                    </div>
                  );
                } else if (rule.targetType === 'deployment') {
                  return (
                    <div className="space-y-2">
                      {hasNoSelectors ? (
                        <>
                          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 px-3 py-1">Global</Badge>
                          <p className="text-sm text-muted-foreground">
                            This rule applies to all deployments in the workspace.
                          </p>
                        </>
                      ) : (
                        <>
                          <Badge variant="secondary">Specific Deployments</Badge>
                          <p className="text-sm text-muted-foreground">
                            This rule applies to {hasDeploymentSelectors 
                              ? rule.conditions.deploymentSelectors?.length 
                              : rule.conditions.selectors?.length} specific deployment{
                                ((hasDeploymentSelectors 
                                  ? rule.conditions.deploymentSelectors?.length 
                                  : rule.conditions.selectors?.length) || 0) !== 1 ? 's' : ''} based on the selectors.
                          </p>
                        </>
                      )}
                    </div>
                  );
                } else { // environment
                  return (
                    <div className="space-y-2">
                      {hasNoSelectors ? (
                        <>
                          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 px-3 py-1">Global</Badge>
                          <p className="text-sm text-muted-foreground">
                            This rule applies to all environments in the workspace.
                          </p>
                        </>
                      ) : (
                        <>
                          <Badge variant="outline">Specific Environments</Badge>
                          <p className="text-sm text-muted-foreground">
                            This rule applies to {hasEnvironmentSelectors 
                              ? rule.conditions.environmentSelectors?.length 
                              : rule.conditions.selectors?.length} specific environment{
                                ((hasEnvironmentSelectors 
                                  ? rule.conditions.environmentSelectors?.length 
                                  : rule.conditions.selectors?.length) || 0) !== 1 ? 's' : ''} based on the selectors.
                          </p>
                        </>
                      )}
                    </div>
                  );
                }
              })()}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-medium mb-1">Priority</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{rule.priority}</Badge>
                  <span className="text-sm text-muted-foreground">
                    (Lower = Higher Priority)
                  </span>
                </div>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-medium mb-1">Status</h3>
                <div className="flex items-center gap-2">
                  <span>{rule.enabled ? 'Enabled' : 'Disabled'}</span>
                  <Switch checked={rule.enabled} disabled />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="text-sm font-medium mb-1">Created</h3>
                <div className="text-sm">{formatDate(rule.createdAt)}</div>
              </div>
              
              {rule.updatedAt && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h3 className="text-sm font-medium mb-1">Last Updated</h3>
                  <div className="text-sm">{formatDate(rule.updatedAt)}</div>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="selectors" className="space-y-4">
            {rule.targetType === 'both' ? (
              <>
                <div className="p-4 bg-muted/30 rounded-md mb-6">
                  <h3 className="text-sm font-medium mb-2">Applicability Matrix</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    This rule applies to the combinations of deployments and environments defined by the selectors below.
                    Each deployment selector is combined with each environment selector to form a matrix of applicability.
                  </p>
                  
                  {/* Visual matrix diagram */}
                  <div className="bg-card rounded-md p-4 border">
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-start gap-2 min-w-[150px]">
                        <div className="text-xs font-medium text-muted-foreground">DEPLOYMENTS</div>
                        {(!rule.conditions.deploymentSelectors || rule.conditions.deploymentSelectors.length === 0) ? (
                          <div className="px-3 py-1 text-sm border rounded-md whitespace-nowrap w-full text-center">
                            All Deployments
                          </div>
                        ) : (
                          rule.conditions.deploymentSelectors.map((selector, i) => (
                            <div key={i} className="px-3 py-1 text-sm border rounded-md whitespace-nowrap w-full text-center">
                              {selector.type === 'metadata' ? `${selector.key}: ${selector.value}` : 
                               selector.type === 'name' ? `Name: ${selector.value}` : 
                               `Tag: ${selector.value}`}
                            </div>
                          ))
                        )}
                      </div>
                      
                      <div className="text-2xl text-muted-foreground font-light">×</div>
                      
                      <div className="flex flex-col items-start gap-2 min-w-[150px]">
                        <div className="text-xs font-medium text-muted-foreground">ENVIRONMENTS</div>
                        {(!rule.conditions.environmentSelectors || rule.conditions.environmentSelectors.length === 0) ? (
                          <div className="px-3 py-1 text-sm border rounded-md whitespace-nowrap w-full text-center">
                            All Environments
                          </div>
                        ) : (
                          rule.conditions.environmentSelectors.map((selector, i) => (
                            <div key={i} className="px-3 py-1 text-sm border rounded-md whitespace-nowrap w-full text-center">
                              {selector.type === 'environment' ? `Name: ${selector.value}` : 
                               `${selector.key}: ${selector.value}`}
                            </div>
                          ))
                        )}
                      </div>
                      
                      <div className="text-2xl text-muted-foreground font-light">=</div>
                      
                      <div className="flex flex-col items-start gap-2">
                        <div className="text-xs font-medium text-muted-foreground">COMBINATIONS</div>
                        <div className="px-3 py-1 text-sm bg-muted/50 rounded-md whitespace-nowrap">
                          {(() => {
                            const dCount = rule.conditions.deploymentSelectors?.length || 0;
                            const eCount = rule.conditions.environmentSelectors?.length || 0;
                            
                            if (dCount === 0 && eCount === 0) {
                              return "All possible combinations";
                            } else if (dCount === 0) {
                              return `${eCount} environment${eCount !== 1 ? 's' : ''} × All deployments`;
                            } else if (eCount === 0) {
                              return `${dCount} deployment${dCount !== 1 ? 's' : ''} × All environments`;
                            } else {
                              return `${dCount} × ${eCount} = ${dCount * eCount} combinations`;
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Deployment Selectors</h3>
                  
                  {!rule.conditions.deploymentSelectors || rule.conditions.deploymentSelectors.length === 0 ? (
                    <div className="text-muted-foreground p-4 border border-dashed rounded-md text-center">
                      No deployment selectors defined. This rule applies to all deployments.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rule.conditions.deploymentSelectors.map((selector, index) => (
                        <div key={index} className="p-3 bg-muted/50 rounded-md">
                          {renderSelector(selector)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t space-y-2">
                  <h3 className="text-sm font-medium">Environment Selectors</h3>
                  
                  {!rule.conditions.environmentSelectors || rule.conditions.environmentSelectors.length === 0 ? (
                    <div className="text-muted-foreground p-4 border border-dashed rounded-md text-center">
                      No environment selectors defined. This rule applies to all environments.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rule.conditions.environmentSelectors.map((selector, index) => (
                        <div key={index} className="p-3 bg-muted/50 rounded-md">
                          {renderSelector(selector)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-medium">
                  {rule.targetType === 'deployment' ? 'Deployment' : 'Environment'} Selectors
                </h3>
                
                {/* For backward compatibility with old rules that use selectors */}
                {rule.conditions.selectors && rule.conditions.selectors.length > 0 && (
                  <div className="space-y-2">
                    {rule.conditions.selectors.map((selector, index) => (
                      <div key={index} className="p-3 bg-muted/50 rounded-md">
                        {renderSelector(selector)}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* For new rules that use targetType-specific selectors */}
                {rule.targetType === 'deployment' && rule.conditions.deploymentSelectors && (
                  <div className="space-y-2">
                    {rule.conditions.deploymentSelectors.length === 0 ? (
                      <div className="text-muted-foreground p-4 border border-dashed rounded-md text-center">
                        No selectors defined. This rule applies to all deployments.
                      </div>
                    ) : (
                      rule.conditions.deploymentSelectors.map((selector, index) => (
                        <div key={index} className="p-3 bg-muted/50 rounded-md">
                          {renderSelector(selector)}
                        </div>
                      ))
                    )}
                  </div>
                )}
                
                {rule.targetType === 'environment' && rule.conditions.environmentSelectors && (
                  <div className="space-y-2">
                    {rule.conditions.environmentSelectors.length === 0 ? (
                      <div className="text-muted-foreground p-4 border border-dashed rounded-md text-center">
                        No selectors defined. This rule applies to all environments.
                      </div>
                    ) : (
                      rule.conditions.environmentSelectors.map((selector, index) => (
                        <div key={index} className="p-3 bg-muted/50 rounded-md">
                          {renderSelector(selector)}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="config" className="space-y-4">
            {(() => {
              const configurations = getRuleConfigurations(rule);
              
              if (configurations.length === 0) {
                return (
                  <div className="text-muted-foreground p-4 border border-dashed rounded-md text-center">
                    No configurations defined for this rule.
                  </div>
                );
              } else if (configurations.length === 1) {
                // Legacy format with single configuration
                return (
                  <>
                    <h3 className="text-sm font-medium">{getRuleTypeLabel(configurations[0].type)} Configuration</h3>
                    <div className="space-y-4">
                      {renderTypeSpecificDetails()}
                    </div>
                  </>
                );
              } else {
                // Multiple configurations format
                return (
                  <>
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium">Multiple Rule Configurations</h3>
                      <Badge variant="outline" className="px-2 py-1">
                        {configurations.length} Types
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground mb-4">
                      This rule combines multiple configuration types. For a deployment to proceed, 
                      <strong> all enabled configurations</strong> must be satisfied.
                    </div>
                    
                    <div className="space-y-6">
                      {renderTypeSpecificDetails()}
                    </div>
                  </>
                );
              }
            })()}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}