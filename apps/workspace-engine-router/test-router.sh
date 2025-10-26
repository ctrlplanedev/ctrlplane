#!/bin/bash
#
# Simple test script for the workspace-engine-router
# This script demonstrates the router's functionality by:
# 1. Starting the router
# 2. Registering a mock worker
# 3. Testing request routing
#

set -e

MANAGEMENT_PORT=9090
ROUTING_PORT=8080

echo "=== Workspace Engine Router Test ==="
echo

# Check if management server is running
if ! curl -s http://localhost:$MANAGEMENT_PORT/healthz > /dev/null 2>&1; then
    echo "Error: Management server is not running on http://localhost:$MANAGEMENT_PORT"
    echo "Start it with: go run main.go"
    exit 1
fi

echo "✓ Management server is running on port $MANAGEMENT_PORT"

# Check if routing server is running
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:$ROUTING_PORT/ 2>&1 | grep -q "[0-9]"; then
    echo "Error: Routing server is not running on http://localhost:$ROUTING_PORT"
    echo "Start it with: go run main.go"
    exit 1
fi

echo "✓ Routing server is running on port $ROUTING_PORT"
echo

# Test health check
echo "Testing health check..."
curl -s http://localhost:$MANAGEMENT_PORT/healthz | jq '.'
echo

# Register a mock worker
echo "Registering mock worker..."
RESPONSE=$(curl -s -X POST http://localhost:$MANAGEMENT_PORT/register \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": "test-worker-1",
    "httpAddress": "http://localhost:8081",
    "partitions": [0, 1, 2]
  }')

echo $RESPONSE | jq '.'
echo

# List workers
echo "Listing registered workers..."
curl -s http://localhost:$MANAGEMENT_PORT/workers | jq '.'
echo

# Test heartbeat
echo "Sending heartbeat..."
curl -s -X POST http://localhost:$MANAGEMENT_PORT/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": "test-worker-1"
  }' | jq '.'
echo

# Test routing (this will fail since we don't have a real worker)
echo "Testing routing on port $ROUTING_PORT (expected to fail with connection error)..."
curl -s http://localhost:$ROUTING_PORT/v1/workspaces/test-workspace-123/status || echo "Expected failure - no real worker running"
echo
echo

# Unregister worker
echo "Unregistering worker..."
curl -s -X POST http://localhost:$MANAGEMENT_PORT/unregister \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": "test-worker-1"
  }' | jq '.'
echo

echo "=== Test Complete ==="
echo
echo "Summary:"
echo "  - Management API: http://localhost:$MANAGEMENT_PORT"
echo "  - Routing/Proxy:  http://localhost:$ROUTING_PORT"

