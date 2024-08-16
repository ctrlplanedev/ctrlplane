# Github Agent

Agent for github workflows

Add this configuration to your workflow in order to use it for testing.

```YAML
run-name: Simple Workflow [${{ inputs.job_execution_id && inputs.job_execution_id || '' }}]

on:
  workflow_dispatch:
    inputs:
      job_execution_id:
        description: 'Job execution ID'
        required: true
```
