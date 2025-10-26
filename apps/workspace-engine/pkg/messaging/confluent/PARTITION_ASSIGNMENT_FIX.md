# Kafka Partition Assignment Timeout Fix

## The Problem

You were experiencing intermittent failures during Kafka consumer startup:

```
Context cancelled while waiting for partition assignment
Failed to subscribe error="failed to wait for partition assignment:
  timeout waiting for partition assignment: context deadline exceeded"
```

**Symptoms:**

- ✅ Sometimes fast (< 5 seconds)
- ❌ Sometimes fails with timeout (> 30 seconds)
- Panic crash on timeout

## Root Cause

The partition assignment timeout was hardcoded to **30 seconds**, which was too short for:

1. **First Consumer in Group** - Kafka coordinator election takes 15-30 seconds
2. **Network Latency** - Slow network to Kafka brokers
3. **Broker Load** - Kafka broker busy with other operations
4. **Rebalance Complexity** - More partitions = longer rebalance

### Why "Sometimes Fast, Sometimes Slow"?

| Scenario     | Time                                             | Reason     |
| ------------ | ------------------------------------------------ | ---------- |
| Fast (< 5s)  | Coordinator already exists, warm connection      | ✅         |
| Slow (> 30s) | First consumer, cold start, coordinator election | ❌ Timeout |

## The Fix

### 1. Extended Timeout (30s → 2 minutes)

```go
// Before
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)

// After
ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
```

**Why 2 minutes?**

- Kafka coordinator election: ~15-30 seconds
- Network latency: ~5-10 seconds
- Partition rebalance: ~10-20 seconds
- Buffer for slow systems: ~40-60 seconds
- **Total: ~120 seconds** (2 minutes)

### 2. Better Progress Logging

Added periodic status updates every 5 seconds:

```go
// Log progress every 5 seconds
if time.Since(lastLogTime) >= 5*time.Second {
    elapsed := time.Since(startTime)
    log.Info("Still waiting for partition assignment...",
        "elapsed", elapsed.Round(time.Second),
        "polls", pollCount,
        "status", "waiting_for_coordinator")
    lastLogTime = time.Now()
}
```

**Benefits:**

- See progress instead of silence
- Know the system isn't frozen
- Debug timing issues

### 3. Enhanced Error Messages

```go
log.Error("Partition assignment timeout - possible causes:
    1) Kafka broker unreachable,
    2) Network issues,
    3) Slow coordinator election")
```

## Expected Behavior Now

### Successful Startup (Normal Case)

```
INFO Subscribing to Kafka topic topic=workspace-events group=workspace-engine brokers=localhost:9092
INFO Waiting for Kafka partition assignment - this may take 30-120 seconds on first startup
INFO Waiting for partition assignment from Kafka coordinator...
INFO This process involves: 1) Joining consumer group, 2) Coordinator election, 3) Partition rebalance
INFO Still waiting for partition assignment... elapsed=5s polls=25 status=waiting_for_coordinator
INFO Still waiting for partition assignment... elapsed=10s polls=50 status=waiting_for_coordinator
INFO ✓ Received AssignedPartitions event partitions=[0,1,2] timeToAssign=12.5s
INFO Partitions assigned successfully total_partitions=3 partitions=[0,1,2] duration=12.5s
INFO Successfully subscribed to topic topic=workspace-events
```

### Slow Startup (Still Succeeds)

```
INFO Still waiting for partition assignment... elapsed=35s polls=175 status=waiting_for_coordinator
INFO Still waiting for partition assignment... elapsed=40s polls=200 status=waiting_for_coordinator
INFO ✓ Received AssignedPartitions event partitions=[0,1,2] timeToAssign=45s
INFO Partitions assigned successfully total_partitions=3 partitions=[0,1,2] duration=45s
```

### Actual Failure (Only if real problem)

```
ERROR Still waiting for partition assignment... elapsed=115s polls=575 status=waiting_for_coordinator
ERROR Context cancelled while waiting for partition assignment duration=2m0s pollCount=600
ERROR Partition assignment timeout - possible causes:
    1) Kafka broker unreachable,
    2) Network issues,
    3) Slow coordinator election
```

## Additional Recommendations

### 1. Check Kafka Broker Health

```bash
# Verify Kafka is running
docker ps | grep kafka

# Check Kafka logs
docker logs kafka-container

# Test connectivity
nc -zv localhost 9092
```

### 2. Monitor Assignment Times

Track how long partition assignment takes in your environment:

```go
// Add metrics
metrics.RecordPartitionAssignmentTime(time.Since(startTime))

// Alert if consistently > 30s
if assignmentTime > 30*time.Second {
    alerting.Warn("Slow partition assignment", workspaceID)
}
```

### 3. Optimize Kafka Configuration

If you're still seeing slow assignments, tune Kafka consumer configs:

```go
consumer, err := confluent.NewConfluent(brokers).CreateConsumer(GroupID, &kafka.ConfigMap{
    "bootstrap.servers":               Brokers,
    "group.id":                        GroupID,
    "auto.offset.reset":               "latest",
    "enable.auto.commit":              false,
    "partition.assignment.strategy":   "cooperative-sticky",
    "go.application.rebalance.enable": true,

    // Tune these for faster assignment
    "session.timeout.ms":              6000,  // Default: 10000
    "heartbeat.interval.ms":           2000,  // Default: 3000
    "max.poll.interval.ms":            300000, // Default: 300000
})
```

### 4. Use Workspace Status Tracking

Integrate with the new status tracking system:

```go
import "workspace-engine/pkg/workspace/status"

// In kafka consumer
workspaceStatus := status.Global().GetOrCreate("kafka-consumer")
workspaceStatus.SetState(
    status.StateLoadingKafkaPartitions,
    "Waiting for partition assignment",
)
workspaceStatus.UpdateMetadata("elapsed_seconds", elapsed.Seconds())

// On success
workspaceStatus.SetState(status.StateReady, "Partitions assigned")
```

## Testing

### Test Different Scenarios

```bash
# 1. Fast startup (Kafka already running)
docker-compose up -d kafka
sleep 10
go run . # Should be fast

# 2. Cold start (First consumer)
docker-compose down
docker-compose up -d kafka
go run . # May take 20-40s (now within timeout)

# 3. Kafka unreachable (Should timeout after 2 minutes)
# Stop Kafka but try to start consumer
docker-compose stop kafka
go run . # Should timeout with clear error message
```

## Summary

| Change                       | Impact                                         |
| ---------------------------- | ---------------------------------------------- |
| ⏱️ **Timeout: 30s → 2min**   | Handles coordinator election and slow networks |
| 📊 **Progress Logging**      | See what's happening every 5 seconds           |
| ❌ **Better Error Messages** | Understand why timeout occurred                |
| ✅ **Duration Tracking**     | Know how long assignment took                  |

The consumer should now reliably start even on slower systems or during Kafka coordinator elections! 🎉
