// Types for our rules data
export type RuleTargetType = 'deployment' | 'environment' | 'both';

export type RuleType = 
  | 'maintenance-window' 
  | 'gradual-rollout' 
  | 'time-window' 
  | 'rollout-ordering' 
  | 'rollout-pass-rate'
  | 'release-dependency'
  | 'approval-gate';

export type SelectorType = 'metadata' | 'name' | 'tag' | 'environment' | 'deployment';

export interface Selector {
  type: SelectorType;
  key?: string;
  value?: string;
  operator: 'equals' | 'not-equals' | 'contains' | 'not-contains' | 'starts-with' | 'ends-with' | 'regex';
  // Specify which target this selector applies to (only relevant when targetType is 'both')
  appliesTo?: 'deployment' | 'environment';
}

export interface RuleConfiguration {
  type: RuleType;
  enabled: boolean;
  config: Record<string, any>;
}

export interface Rule {
  id: string;
  name: string;
  description?: string;
  priority: number; // Lower number = higher priority
  targetType: RuleTargetType;
  enabled: boolean;
  conditions: {
    deploymentSelectors?: Selector[];
    environmentSelectors?: Selector[];
    // For backward compatibility with existing rules
    selectors?: Selector[];
  };
  // Support for legacy single-type rules
  type?: RuleType;
  configuration?: Record<string, any>;
  // Support for multiple configurations
  configurations?: RuleConfiguration[];
  createdAt: string;
  updatedAt?: string;
}

// Mock rules
export const mockRules: Rule[] = [
  // Legacy rules with a single configuration
  {
    id: "rule-001",
    name: "Production Deployment Window",
    description: "Restrict deployments to production environments to business hours",
    priority: 10,
    type: "time-window",
    targetType: "environment",
    enabled: true,
    conditions: {
      environmentSelectors: [
        {
          type: "environment",
          value: "production",
          operator: "equals"
        }
      ]
    },
    configuration: {
      timezone: "America/New_York",
      windows: [
        { days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"], startTime: "09:00", endTime: "17:00" }
      ]
    },
    createdAt: "2023-01-15T12:00:00Z"
  },
  {
    id: "rule-002",
    name: "Frontend Gradual Rollout",
    description: "Gradually rollout frontend services to minimize user impact",
    priority: 20,
    type: "gradual-rollout",
    targetType: "deployment",
    enabled: true,
    conditions: {
      deploymentSelectors: [
        {
          type: "metadata",
          key: "service-type",
          value: "frontend",
          operator: "equals"
        }
      ]
    },
    configuration: {
      stages: [
        { percentage: 10, durationMinutes: 30 },
        { percentage: 50, durationMinutes: 60 },
        { percentage: 100, durationMinutes: 0 }
      ],
      rollbackThreshold: {
        errorRate: 5,
        responseTime: 500
      }
    },
    createdAt: "2023-02-20T15:30:00Z",
    updatedAt: "2023-03-10T10:15:00Z"
  },
  {
    id: "rule-003",
    name: "Monthly Maintenance Window",
    description: "Schedule monthly maintenance window for system updates",
    priority: 5,
    type: "maintenance-window",
    targetType: "environment",
    enabled: true,
    conditions: {
      environmentSelectors: [
        {
          type: "environment",
          operator: "contains",
          value: "prod"
        }
      ]
    },
    configuration: {
      recurrence: "MONTHLY",
      dayOfMonth: 15,
      startTime: "01:00",
      duration: 120,
      timezone: "UTC",
      notification: {
        beforeMinutes: [1440, 60]
      }
    },
    createdAt: "2023-03-05T09:45:00Z"
  },
  {
    id: "rule-004",
    name: "Database Deployment Order",
    description: "Ensure databases are deployed in correct order",
    priority: 15,
    type: "rollout-ordering",
    targetType: "deployment",
    enabled: true,
    conditions: {
      deploymentSelectors: [
        {
          type: "metadata",
          key: "component-type",
          value: "database",
          operator: "equals"
        }
      ]
    },
    configuration: {
      order: [
        { name: "schema-migrations", delayAfterMinutes: 10 },
        { name: "read-replicas", delayAfterMinutes: 5 },
        { name: "cache-services", delayAfterMinutes: 0 }
      ],
      failFast: true
    },
    createdAt: "2023-04-12T14:20:00Z"
  },
  {
    id: "rule-005",
    name: "API Success Rate Requirement",
    description: "Require 99% success rate for API deployments",
    priority: 25,
    type: "rollout-pass-rate",
    targetType: "deployment",
    enabled: true,
    conditions: {
      deploymentSelectors: [
        {
          type: "metadata",
          key: "service-type",
          value: "api",
          operator: "equals"
        }
      ]
    },
    configuration: {
      metricName: "http_success_percentage",
      threshold: 99,
      observationWindowMinutes: 15,
      minimumSampleSize: 100
    },
    createdAt: "2023-05-18T11:10:00Z"
  },
  {
    id: "rule-006",
    name: "Release Dependency Chain",
    description: "Ensure frontend is deployed after backend",
    priority: 18,
    type: "release-dependency",
    targetType: "deployment",
    enabled: true,
    conditions: {
      deploymentSelectors: [
        {
          type: "metadata",
          key: "service-name",
          value: "web-ui",
          operator: "equals"
        }
      ]
    },
    configuration: {
      dependencies: [
        { name: "api-service", requiredVersion: ">=1.2.0" },
        { name: "auth-service", requiredVersion: ">=2.0.0" }
      ],
      waitForStability: true,
      timeoutMinutes: 60
    },
    createdAt: "2023-06-25T16:40:00Z"
  },
  {
    id: "rule-007",
    name: "Testing Environment Window",
    description: "Allow deployments to testing anytime except weekends",
    priority: 30,
    type: "time-window",
    targetType: "environment",
    enabled: false,
    conditions: {
      environmentSelectors: [
        {
          type: "environment",
          value: "testing",
          operator: "equals"
        }
      ]
    },
    configuration: {
      timezone: "UTC",
      windows: [
        { days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"], startTime: "00:00", endTime: "23:59" }
      ]
    },
    createdAt: "2023-07-05T08:30:00Z",
    updatedAt: "2023-08-12T13:20:00Z"
  },
  
  // New rules with multiple configurations
  {
    id: "rule-008",
    name: "Multi-Configuration Infrastructure Rule",
    description: "Complex rule with multiple configuration options for infrastructure services",
    priority: 12,
    targetType: "deployment",
    enabled: true,
    conditions: {
      deploymentSelectors: [
        {
          type: "tag",
          value: "infrastructure",
          operator: "contains"
        }
      ]
    },
    configurations: [
      {
        type: "gradual-rollout",
        enabled: true,
        config: {
          stages: [
            { percentage: 25, durationMinutes: 60 },
            { percentage: 75, durationMinutes: 120 },
            { percentage: 100, durationMinutes: 0 }
          ],
          rollbackThreshold: {
            errorRate: 2,
            cpuUtilization: 85
          }
        }
      },
      {
        type: "release-dependency",
        enabled: true,
        config: {
          dependencies: [
            { name: "core-services", requiredVersion: ">=2.1.0" },
            { name: "monitoring", requiredVersion: ">=3.0.0" }
          ],
          waitForStability: true,
          timeoutMinutes: 45
        }
      }
    ],
    createdAt: "2023-08-30T10:15:00Z"
  },
  {
    id: "rule-009",
    name: "Critical Services Combined Rules",
    description: "Complete rule set for critical services with multiple checks",
    priority: 8,
    targetType: "both",
    enabled: true,
    conditions: {
      deploymentSelectors: [
        {
          type: "metadata",
          key: "criticality",
          value: "high",
          operator: "equals",
          appliesTo: "deployment"
        }
      ],
      environmentSelectors: [
        {
          type: "environment",
          value: "production",
          operator: "equals",
          appliesTo: "environment"
        }
      ]
    },
    configurations: [
      {
        type: "time-window",
        enabled: true,
        config: {
          timezone: "UTC",
          windows: [
            { 
              days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"], 
              startTime: "10:00", 
              endTime: "16:00" 
            }
          ],
          approvers: ["ops-team", "security-team"],
          requiredApprovals: 2
        }
      },
      {
        type: "maintenance-window",
        enabled: false,
        config: {
          recurrence: "MONTHLY",
          dayOfMonth: 1,
          startTime: "02:00",
          duration: 180,
          timezone: "UTC",
          notification: {
            beforeMinutes: [2880, 1440, 60]
          }
        }
      },
      {
        type: "rollout-pass-rate",
        enabled: true,
        config: {
          metricName: "error_rate",
          threshold: 1, // Maximum 1% error rate allowed
          observationWindowMinutes: 30,
          minimumSampleSize: 500
        }
      }
    ],
    createdAt: "2023-09-12T14:30:00Z",
    updatedAt: "2023-09-15T09:45:00Z"
  },
  {
    id: "rule-010",
    name: "Weekly Maintenance + Time Windows",
    description: "Combined rule for maintenance windows and regular deployment windows",
    priority: 15,
    targetType: "environment",
    enabled: true,
    conditions: {
      environmentSelectors: [
        {
          type: "environment",
          value: "staging",
          operator: "equals"
        }
      ]
    },
    configurations: [
      {
        type: "maintenance-window",
        enabled: true,
        config: {
          recurrence: "WEEKLY",
          startTime: "22:00",
          duration: 240,
          timezone: "UTC",
          notification: {
            beforeMinutes: [1440, 120]
          }
        }
      },
      {
        type: "time-window",
        enabled: true,
        config: {
          timezone: "UTC",
          windows: [
            { 
              days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"], 
              startTime: "08:00", 
              endTime: "18:00" 
            }
          ]
        }
      }
    ],
    createdAt: "2023-10-05T11:30:00Z"
  },
  {
    id: "rule-011",
    name: "Production Approval Gate",
    description: "Require manual approval for all production deployments",
    priority: 5,
    type: "approval-gate",
    targetType: "environment",
    enabled: true,
    conditions: {
      environmentSelectors: [
        {
          type: "environment",
          value: "production",
          operator: "equals"
        }
      ]
    },
    configuration: {
      approvers: [
        { role: "SRE", count: 1 },
        { role: "Product", count: 1 }
      ],
      totalApprovalsRequired: 2,
      timeoutHours: 24,
      notifications: {
        channels: ["slack-ops", "email-team"]
      }
    },
    createdAt: "2023-11-12T14:25:00Z",
    updatedAt: "2023-12-01T09:10:00Z"
  }
];