#!/bin/bash
# Example API client for workspace engine Gin server
# Usage: ./example_client.sh [base-url]

BASE_URL="${1:-http://localhost:8081}"
WORKSPACE_ID="test-workspace"

echo "=== Workspace Engine API Client Example ==="
echo "Base URL: $BASE_URL"
echo "Workspace ID: $WORKSPACE_ID"
echo

# Health check
echo "1. Health Check"
curl -s "$BASE_URL/healthz" | jq .
echo

# Create a resource
echo "2. Create Resource"
curl -s -X POST "$BASE_URL/api/v1/workspaces/$WORKSPACE_ID/resources" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "res-001",
    "name": "Test Resource",
    "kind": "kubernetes",
    "identifier": "test-cluster",
    "config": {"region": "us-west-2"},
    "metadata": {"environment": "dev"},
    "workspaceId": "'"$WORKSPACE_ID"'",
    "version": "v1",
    "createdAt": "2024-01-01T00:00:00Z"
  }' | jq .
echo

# List resources
echo "3. List Resources"
curl -s "$BASE_URL/api/v1/workspaces/$WORKSPACE_ID/resources" | jq .
echo

# Create an environment
echo "4. Create Environment"
curl -s -X POST "$BASE_URL/api/v1/workspaces/$WORKSPACE_ID/environments" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "env-001",
    "name": "Development",
    "systemId": "sys-001",
    "createdAt": "2024-01-01T00:00:00Z"
  }' | jq .
echo

# List environments
echo "5. List Environments"
curl -s "$BASE_URL/api/v1/workspaces/$WORKSPACE_ID/environments" | jq .
echo

# Compute release targets
echo "6. Compute Release Targets"
curl -s -X POST "$BASE_URL/api/v1/workspaces/$WORKSPACE_ID/release-targets/compute" \
  -H "Content-Type: application/json" \
  -d '{
    "environments": [
      {
        "id": "env-001",
        "name": "Development",
        "systemId": "sys-001",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "deployments": [
      {
        "id": "dep-001",
        "name": "API Deployment",
        "slug": "api",
        "systemId": "sys-001",
        "jobAgentConfig": {}
      }
    ],
    "resources": [
      {
        "id": "res-001",
        "name": "Test Resource",
        "kind": "kubernetes",
        "identifier": "test-cluster",
        "config": {},
        "metadata": {},
        "workspaceId": "'"$WORKSPACE_ID"'",
        "version": "v1",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ]
  }' | jq .
echo

# List jobs
echo "7. List Jobs"
curl -s "$BASE_URL/api/v1/workspaces/$WORKSPACE_ID/jobs" | jq .
echo

# List releases
echo "8. List Releases"
curl -s "$BASE_URL/api/v1/workspaces/$WORKSPACE_ID/releases" | jq .
echo

# List policies
echo "9. List Policies"
curl -s "$BASE_URL/api/v1/workspaces/$WORKSPACE_ID/policies" | jq .
echo

# Delete resource
echo "10. Delete Resource"
curl -s -X DELETE "$BASE_URL/api/v1/workspaces/$WORKSPACE_ID/resources/res-001" | jq .
echo

# Delete environment
echo "11. Delete Environment"
curl -s -X DELETE "$BASE_URL/api/v1/workspaces/$WORKSPACE_ID/environments/env-001" | jq .
echo

echo "=== Test Complete ==="

