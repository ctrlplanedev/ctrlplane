# Workflows Design Document

> **Status**: Draft  
> **Created**: 2026-01-12

## Overview

This document proposes adding **Workflows** to Ctrlplane, enabling multi-step deployment orchestration. Workflows extend the existing job dispatch model—Ctrlplane controls **when** tasks execute, **what** parameters to pass, and **how** to configure them, while the actual execution happens in external systems (GitHub Actions, ArgoCD, Terraform Cloud, etc.) via job agents.

### Problem Statement

Currently, a single release creates a single job. This works for simple deployments but lacks support for:

- **Multi-step deployments** - Run migrations before deploying, then verify
- **Task dependencies** - Task B waits for Task A to complete
- **Parallel execution** - Run independent tasks simultaneously
- **Fan-out execution** - Run the same workflow across multiple resources

### Design Principles

- Reuse existing job dispatch infrastructure (job agents handle execution)
- Follow Argo Workflows naming conventions for familiarity
- Keep Ctrlplane as the orchestrator—no execution runtime in Ctrlplane itself

---

## Core Concepts

### Terminology

| Concept              | What It Is                                                 | Analogy           |
| -------------------- | ---------------------------------------------------------- | ----------------- |
| **WorkflowTemplate** | A reusable definition of a workflow—the blueprint          | Class definition  |
| **Workflow**         | A running (or completed) instance of a WorkflowTemplate    | Class instance    |
| **Task**             | A unit of work defined in the template                     | Method definition |
| **TaskRun**          | The execution record of a task, stores resolved parameters | Method invocation |
| **Job**              | The actual work dispatched to an external system           | External API call |

### Relationship

```
WorkflowTemplate (reusable blueprint)
    │
    │ instantiates
    ▼
Workflow (execution instance)
    ├── parameters: { version: "v1.2.3", ... }
    ├── matrixValues: { targets: [resource1, resource2, resource3] }  ← evaluated matrix
    │
    │ contains
    ▼
TaskRun[] (execution record per task)
    ├── resolvedConfig: { ... }     ← snapshot of config passed to job
    ├── matrixIndex: 0              ← which matrix item (null if no matrix)
    ├── matrixKey: "targets"        ← which matrix parameter (null if no matrix)
    │
    │ creates (for job-type tasks)
    ▼
Job (dispatched to external system)
    │
    │ executes in
    ▼
External System (GitHub Actions, ArgoCD, etc.)
```

### Matrix Expansion

When a task uses a matrix parameter, one TaskRun is created per matrix item:

```
WorkflowTemplate
    └── task: "deploy" with matrix: "{{workflow.parameters.targets}}"

                            ▼ instantiate

Workflow
    └── matrixValues.targets: [resource1, resource2, resource3]

                            ▼ expand matrix

TaskRun: "deploy[0]"          TaskRun: "deploy[1]"          TaskRun: "deploy[2]"
├── matrixIndex: 0            ├── matrixIndex: 1            ├── matrixIndex: 2
├── matrixKey: "targets"      ├── matrixKey: "targets"      ├── matrixKey: "targets"
├── resolvedConfig: {         ├── resolvedConfig: {         ├── resolvedConfig: {
│     app: "app-resource1"    │     app: "app-resource2"    │     app: "app-resource3"
│   }                         │   }                         │   }
└── jobId: job_aaa            └── jobId: job_bbb            └── jobId: job_ccc
```

**Without matrix**: 1 Task → 1 TaskRun → 1 Job  
**With matrix**: 1 Task → N TaskRuns → N Jobs (one per matrix item)

---

## Data Structure

The data model consists of four main entities that form a hierarchy from template to execution.

### WorkflowTemplate

The **blueprint** that defines the workflow structure. Stored once, referenced many times.

```
WorkflowTemplate
├── id
├── name
├── scope (workspace | system | deployment)
├── scopeId (workspaceId | systemId | deploymentId)
├── spec
│   ├── parameters[]        # Parameter definitions (name, type, default)
│   └── tasks[]             # Task definitions with type, config, dependencies
└── metadata (createdAt, updatedAt)
```

### Workflow

An **instance** of a WorkflowTemplate being executed. Created when a workflow is triggered (by release, manual, or hook). Stores the resolved workflow-level parameters.

```
Workflow
├── id
├── workflowTemplateId      # Reference to template
├── releaseId               # Optional: if triggered by release
├── parameters              # Resolved workflow-level parameters (snapshot)
│   └── { version: "v1.2.3", runMigrations: true, ... }
├── status
│   ├── phase               # Pending | Running | Succeeded | Failed | Cancelled
│   ├── startedAt
│   └── finishedAt
└── metadata (createdAt, updatedAt)
```

### TaskRun

The **execution record** for a single task within a workflow. This is where the resolved configuration is stored—the exact parameters that were passed to the job.

- **Without matrix**: One task in template → one TaskRun → one Job
- **With matrix**: One task in template → N TaskRuns → N Jobs (one per matrix item)

```
TaskRun
├── id
├── workflowId              # Parent workflow
├── taskName                # Name from template (e.g., "deploy")
├── matrixIndex             # Null if no matrix, otherwise 0, 1, 2...
├── matrixItem              # Null if no matrix, otherwise the resolved matrix value
│   └── { resource: { name: "cluster-us-east", config: {...} } }
├── resolvedConfig          # Snapshot of fully resolved configuration
│   └── {                   # This is what was actually passed to the job
│         jobAgentRef: "argocd",
│         config: {
│           application: "api-cluster-us-east",
│           revision: "v1.2.3",
│           namespace: "production"
│         }
│       }
├── jobId                   # Reference to created Job (for job-type tasks)
├── status
│   ├── phase               # Pending | Running | Succeeded | Failed | Skipped
│   ├── startedAt
│   ├── finishedAt
│   └── message
└── outputs                 # Outputs from task execution (for downstream tasks)
```

### Job (Existing)

The existing **Job** entity remains unchanged. TaskRun creates and references Jobs for job-type tasks.

```
Job
├── id
├── releaseId
├── jobAgentId
├── jobAgentConfig          # Merged config passed to agent
├── status
└── ...
```

### Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WorkflowTemplate                               │
│  (blueprint, stored once)                                               │
│                                                                          │
│  parameters: [{ name: "version" }, { name: "targets", type: "matrix" }] │
│  tasks: [{ name: "deploy", type: "job", jobAgentRef: "argocd", ... }]   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ instantiates (1:N)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Workflow                                    │
│  (instance, stores resolved workflow parameters)                        │
│                                                                          │
│  parameters: { version: "v1.2.3", targets: [resource1, resource2, ...] }│
│  status: Running                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ contains (1:N)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              TaskRun                                     │
│  (execution record, stores resolved task config)                        │
│                                                                          │
│  Example without matrix (1 task → 1 TaskRun → 1 Job):                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ TaskRun: "migrate-db"                                            │    │
│  │ resolvedConfig: { workflowFile: "migrate.yml", ... }            │    │
│  │ jobId: job_111                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Example with matrix (1 task → N TaskRuns → N Jobs):                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ TaskRun: "deploy[0]"                                             │    │
│  │ matrixIndex: 0                                                   │    │
│  │ matrixItem: { resource: { name: "cluster-us-east", ... } }      │    │
│  │ resolvedConfig: { application: "api-cluster-us-east", ... }     │    │
│  │ jobId: job_222                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ TaskRun: "deploy[1]"                                             │    │
│  │ matrixIndex: 1                                                   │    │
│  │ matrixItem: { resource: { name: "cluster-us-west", ... } }      │    │
│  │ resolvedConfig: { application: "api-cluster-us-west", ... }     │    │
│  │ jobId: job_333                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ creates (1:1 per TaskRun)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                Job                                       │
│  (dispatched to external system)                                        │
│                                                                          │
│  jobAgentConfig: { application: "api-cluster-us-east", revision: "..." }│
│  status: Completed                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why TaskRun Stores Resolved Config

The `resolvedConfig` on TaskRun is critical for:

1. **Auditability** - Know exactly what configuration was passed to a job
2. **Debugging** - See the fully resolved values after variable substitution
3. **Matrix traceability** - Each matrix item has its own TaskRun with its specific config
4. **Idempotency** - Can recreate/retry with the same configuration
5. **Decoupling** - Template can change without affecting in-flight workflows

### Example: Matrix Expansion

Given a workflow template with a matrix task:

```yaml
parameters:
  - name: targets
    type: matrix
    source:
      kind: resource
      selector: { kind: "Kubernetes" }

tasks:
  - name: deploy
    type: job
    jobAgentRef: argocd
    config:
      application: "{{matrix.resource.name}}"
    matrix: "{{workflow.parameters.targets}}"
```

If the selector matches 3 resources, the data structure becomes:

```
Workflow (id: wf_123)
├── parameters: { targets: [resource1, resource2, resource3] }
├── TaskRuns:
│   ├── TaskRun (taskName: "deploy", matrixIndex: 0)
│   │   ├── matrixItem: { resource: resource1 }
│   │   ├── resolvedConfig: { application: "app-resource1", ... }
│   │   └── jobId: job_aaa
│   │
│   ├── TaskRun (taskName: "deploy", matrixIndex: 1)
│   │   ├── matrixItem: { resource: resource2 }
│   │   ├── resolvedConfig: { application: "app-resource2", ... }
│   │   └── jobId: job_bbb
│   │
│   └── TaskRun (taskName: "deploy", matrixIndex: 2)
│       ├── matrixItem: { resource: resource3 }
│       ├── resolvedConfig: { application: "app-resource3", ... }
│       └── jobId: job_ccc
```

---

## WorkflowTemplate

A **WorkflowTemplate** defines what tasks to run, in what order, and with what configuration.

### Scoping

Templates can be scoped to different levels:

| Scope          | Visibility                |
| -------------- | ------------------------- |
| **Workspace**  | All systems in workspace  |
| **System**     | All deployments in system |
| **Deployment** | Single deployment         |

Resolution order (most specific wins): Deployment → System → Workspace

### Structure

```yaml
apiVersion: ctrlplane.dev/v1
kind: WorkflowTemplate
metadata:
  name: multi-cluster-deployment
  scope: system
spec:
  parameters:
    - name: version
      type: string
      required: true

    - name: runMigrations
      type: boolean
      default: false

    - name: clusters
      type: matrix
      source:
        kind: resource
        selector:
          type: kind
          operator: equals
          value: "Kubernetes"

  tasks:
    - name: migrate-db
      type: job
      jobAgentRef: github-actions
      config:
        workflowFile: migrate.yml
      when: "{{workflow.parameters.runMigrations}}"

    - name: deploy
      type: job
      jobAgentRef: argocd
      config:
        application: "app-{{matrix.resource.name}}"
        revision: "{{workflow.parameters.version}}"
        namespace: "{{matrix.resource.config.namespace}}"
      dependencies: [migrate-db]
      matrix: "{{workflow.parameters.clusters}}"
      matrixStrategy:
        maxParallel: 2
        failFast: false

    - name: verify
      type: verification
      verification:
        metrics:
          - name: error-rate
            provider:
              type: datadog
              query: "sum:errors{service:app-{{matrix.resource.name}}}.as_rate()"
            successCondition: result.value < 0.01
      dependencies: [deploy]
      matrix: "{{workflow.parameters.clusters}}"
```

In this example:

- `migrate-db` runs once (no matrix)
- `deploy` runs once per cluster matching the selector (fan-out)
- `verify` runs once per cluster after its corresponding deploy completes

### Task Types

| Type             | Description                    |
| ---------------- | ------------------------------ |
| **job**          | Dispatches work to a job agent |
| **verification** | Runs verification checks       |
| **approval**     | Pauses for manual approval     |
| **wait**         | Pauses for a duration          |
| **webhook**      | Makes HTTP requests            |

Tasks define their dependencies directly. The workflow engine determines execution order from the dependency graph (parallel when possible, sequential when dependencies exist).

---

## Workflow

A **Workflow** is an instance of a WorkflowTemplate being executed. It tracks the state of each task and overall progress.

### Structure

```yaml
apiVersion: ctrlplane.dev/v1
kind: Workflow
metadata:
  id: wf_abc123
spec:
  workflowTemplateId: wft_standard-deployment
  releaseId: rel_xyz789
  parameters:
    version: "v1.2.3"
    runMigrations: true
status:
  phase: Running
  startedAt: "2026-01-12T10:00:00Z"
```

Task execution state is tracked in **TaskRun** records (see Data Structure section).

### States

| Workflow Phase | Description               |
| -------------- | ------------------------- |
| `Pending`      | Created, waiting to start |
| `Running`      | Executing tasks           |
| `Succeeded`    | All tasks completed       |
| `Failed`       | One or more tasks failed  |
| `Cancelled`    | Manually cancelled        |

| Task Phase  | Description                     |
| ----------- | ------------------------------- |
| `Pending`   | Waiting for dependencies        |
| `Running`   | Dispatched, awaiting completion |
| `Succeeded` | Completed successfully          |
| `Failed`    | Failed                          |
| `Skipped`   | Skipped (when condition false)  |

---

## Parameters

Parameters allow workflows to be customized at runtime.

### Definition

```yaml
parameters:
  - name: version
    type: string
    required: true

  - name: replicaCount
    type: number
    default: 3

  - name: runMigrations
    type: boolean
    default: false

  - name: strategy
    type: string
    enum: ["rolling", "blue-green", "canary"]
    default: "rolling"
```

### Types

| Type      | Example              |
| --------- | -------------------- |
| `string`  | `"v1.2.3"`           |
| `number`  | `3`                  |
| `boolean` | `true`               |
| `object`  | `{ "key": "value" }` |
| `array`   | `["a", "b"]`         |

### Sources (Priority Order)

1. **Explicit** - Passed when creating workflow (highest)
2. **Version config** - From `release.version.config.*`
3. **Deployment variables** - Resolved for environment
4. **Template defaults** - From parameter definition (lowest)

---

## Matrix Parameters

Matrix parameters enable running a task across multiple items—useful for deploying to multiple resources.

### Definition

```yaml
parameters:
  - name: targets
    type: matrix
    source:
      kind: resource
      selector:
        type: kind
        operator: equals
        value: "Kubernetes"
```

### Sources

| Source Kind     | Description                      |
| --------------- | -------------------------------- |
| `resource`      | Resources matching a selector    |
| `environment`   | Environments matching a selector |
| `releaseTarget` | Release targets for a deployment |
| `list`          | Explicit list of values          |

### Usage

```yaml
tasks:
  - name: deploy
    type: job
    jobAgentRef: argocd
    config:
      application: "{{matrix.resource.name}}"
      namespace: "{{matrix.resource.config.namespace}}"
    matrix: "{{workflow.parameters.targets}}"
    matrixStrategy:
      maxParallel: 2
      failFast: false
```

### Matrix Context

```yaml
{{matrix.resource.name}}      # Current resource
{{matrix.resource.config.*}}  # Resource config
{{matrix.index}}              # 0, 1, 2, ...
{{matrix.length}}             # Total items
{{matrix.isFirst}}            # true for first
{{matrix.isLast}}             # true for last
```

---

## Workflow Creation

### 1. Release-Triggered

When a deployment has a `workflowTemplateRef`, releases automatically create workflows:

```yaml
deployments:
  - name: API Service
    workflowTemplateRef:
      name: standard-deployment
      scope: system
```

### 2. Manual Trigger

Users can trigger workflows directly with custom parameters via API.

### 3. Hook-Triggered (Future Scope)

> **Out of scope for initial implementation**

Workflows could be triggered by events:

```yaml
hooks:
  - event: verification.failed
    workflowTemplateRef: rollback-workflow
    parameterMapping:
      targetVersion: "{{event.release.previousVersion}}"
```

**Potential events**: `release.created`, `release.failed`, `verification.failed`, `job.failed`, `resource.created`, `resource.updated`

---

## Variable Context

Workflows have access to:

```yaml
# Workflow
{{workflow.parameters.*}}
{{workflow.name}}

# Release (when release-triggered)
{{release.version.tag}}
{{release.deployment.name}}
{{release.environment.name}}
{{release.resource.name}}
{{release.resource.config.*}}

# Variables
{{variables.REPLICA_COUNT}}

# Matrix (when in matrix task)
{{matrix.resource.*}}
{{matrix.index}}

# Previous tasks
{{tasks.taskName.outputs.*}}
```

---

## References

- [Argo Workflows Concepts](https://argo-workflows.readthedocs.io/en/release-3.7/workflow-concepts/)
- [Releases & Jobs](./docs/concepts/releases-and-jobs.mdx)
