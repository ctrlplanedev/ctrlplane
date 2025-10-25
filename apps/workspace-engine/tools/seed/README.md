# Workspace Seed CLI

A CLI tool for seeding workspaces with test data using Cobra.

## Installation

Build the CLI:

```bash
cd apps/workspace-engine/test/seed
go build -o seed seed.go
```

Or run directly:

```bash
go run seed.go [command]
```

## Configuration

### Environment Variables

The CLI automatically loads environment variables from a `.env` file in the current directory if it exists.

Create a `.env` file:

```bash
# Copy the example file
cp env.example .env

# Edit with your values
BOOTSTRAP_SERVER=localhost:9092
WORKSPACE_ID=my-workspace
```

**Supported environment variables:**

- `BOOTSTRAP_SERVER`: Kafka bootstrap server
- `WORKSPACE_ID`: Target workspace ID

**Priority order (highest to lowest):**

1. Command-line flags
2. Environment variables
3. Default values

### Custom .env File

Use a custom .env file location:

```bash
seed random resources 100 --env-file /path/to/custom.env
```

## Commands

### Global Flags

All commands support these flags:

- `--bootstrap-server`: Kafka bootstrap server (default: `localhost:9092`)
- `--workspace-id`: Target workspace ID (required, can be set via `WORKSPACE_ID` env var)
- `--env-file`: Path to .env file (default: `.env` in current directory)

### `seed file [path]`

Seeds a workspace from a JSON file containing events.

**Usage:**

```bash
seed file example.json --workspace-id my-workspace
```

**With custom Kafka server:**

```bash
seed file example.json \
  --workspace-id my-workspace \
  --bootstrap-server kafka.example.com:9092
```

**Example files:**

- `example.json`: Simple example with systems, deployments, and environments
- `k8s-resources.json`: Large set of Kubernetes and cloud resources

### `seed random resources [count]`

Generates and seeds random resources with realistic metadata and configurations.

**Usage:**

```bash
seed random resources 100 --workspace-id my-workspace
```

**With reproducible seed:**

```bash
seed random resources 500 \
  --workspace-id test-ws \
  --seed 12345
```

**Flags:**

- `--seed`: Random seed for reproducible generation (default: `0` = current time)

**Generated Resource Types:**

The generator randomly creates resources from various cloud providers and Kubernetes:

- **Kubernetes**: Clusters, Namespaces, Pods, Deployments, Services
- **AWS**: Accounts, EC2 Instances, RDS Databases, S3 Buckets, Lambda Functions
- **Azure**: Subscriptions, Virtual Machines, Storage Accounts
- **GCP**: Projects, GCE Instances, GKE Clusters, Cloud SQL Databases

**Resource Attributes:**

Each resource includes:

- Randomized metadata (region, environment, team, cost-center)
- Kind-specific configuration (instance types, replicas, storage sizes, etc.)
- Custom labels
- Realistic timestamps (within last 30 days)

## Examples

### Basic Usage

Seed 20 random resources:

```bash
seed random resources 20 --workspace-id my-workspace
```

Seed from a file:

```bash
seed file example.json --workspace-id my-workspace
```

### Using .env File

Create a `.env` file with your configuration:

```bash
echo "WORKSPACE_ID=my-workspace" > .env
echo "BOOTSTRAP_SERVER=localhost:9092" >> .env
```

Then run commands without flags:

```bash
# No need to specify --workspace-id or --bootstrap-server
seed random resources 100

# Or with a custom env file
seed random resources 100 --env-file config/.env
```

### Load Testing

Generate 10,000 random resources:

```bash
seed random resources 10000 --workspace-id load-test
```

### Reproducible Test Data

Generate the same set of resources every time:

```bash
seed random resources 1000 --workspace-id test --seed 42
```

### Custom Kafka Server

Use a different Kafka cluster:

```bash
seed random resources 100 \
  --workspace-id prod-workspace \
  --bootstrap-server kafka.prod.example.com:9092
```

## Event Format

All commands publish events to the `workspace-events` Kafka topic in this format:

```json
{
  "eventType": "resource.created",
  "workspaceId": "my-workspace",
  "timestamp": 1729800000000,
  "data": {
    "id": "resource-id",
    "workspaceId": "my-workspace",
    "name": "resource-name",
    "kind": "KubernetesCluster",
    "version": "ctrlplane.dev/v1",
    "identifier": "resource/us-east-1/KubernetesCluster/abc-123",
    "createdAt": "2025-10-24T12:00:00Z",
    "config": {},
    "metadata": {}
  }
}
```

## Help

Get help for any command:

```bash
seed --help
seed file --help
seed random --help
seed random resources --help
```

## Tips

- Start small (100-1000 resources) to test your workspace
- Use `--seed` for reproducible test data
- Monitor Kafka and workspace-engine logs during seeding
- For very large datasets (>10k resources), consider batching or rate limiting
- The `--workspace-id` flag is required for all commands
