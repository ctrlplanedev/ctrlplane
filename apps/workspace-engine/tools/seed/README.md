# Workspace Seed CLI

A CLI tool for seeding workspaces with test data using Cobra.

## Quick Start

```bash
# 1. Build the tool
cd apps/workspace-engine/tools/seed
go build -o seed seed.go

# 2. Set up environment (optional but recommended)
cp example.env .env
# Edit .env and set your WORKSPACE_ID

# 3. Seed data
./seed random resources 20              # Generate 20 random resources
./seed file example.json                 # Or load from a JSON file
```

## Installation

Build the CLI:

```bash
cd apps/workspace-engine/tools/seed
go build -o seed seed.go
```

Or run directly:

```bash
go run seed.go [command]
```

Or from the workspace-engine directory:

```bash
cd apps/workspace-engine
go run tools/seed/seed.go [command]
```

## Configuration

### Environment Variables

The CLI automatically loads environment variables from a `.env` file in the current directory if it exists. This allows you to avoid specifying `--workspace-id` and `--bootstrap-server` on every command.

**Quick Start:**

```bash
# Copy the example file
cp example.env .env

# Edit with your values
cat > .env << EOF
BOOTSTRAP_SERVER=localhost:9092
WORKSPACE_ID=my-workspace
EOF

# Now run commands without flags!
seed random resources 20
```

**Supported environment variables:**

- `BOOTSTRAP_SERVER`: Kafka bootstrap server address
- `WORKSPACE_ID`: Target workspace ID (required if not provided via flag)

**Priority order (highest to lowest):**

1. Command-line flags (always override environment variables)
2. Environment variables (from `.env` file or shell environment)
3. Default values (only for `BOOTSTRAP_SERVER`)

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

- **Use .env files**: Set `WORKSPACE_ID` in a `.env` file to avoid typing it on every command
- **Start small**: Test with 100-1000 resources before generating large datasets
- **Reproducible data**: Use `--seed` flag for consistent test data across runs
- **Monitor logs**: Watch Kafka and workspace-engine logs during seeding
- **Large datasets**: For >10k resources, consider batching or rate limiting
- **Command-line overrides**: Flags always take precedence over environment variables

## Troubleshooting

### "workspace-id is required" error

Make sure you've either:

- Set `WORKSPACE_ID` in your `.env` file, or
- Provide `--workspace-id` flag

```bash
# Check if .env file exists and contains WORKSPACE_ID
cat .env | grep WORKSPACE_ID

# Or use the flag directly
seed random resources 20 --workspace-id my-workspace
```

### .env file not being loaded

The CLI looks for `.env` in the **current directory** where you run the command, not where the binary is located.

```bash
# Wrong: .env is in tools/seed but you're running from elsewhere
cd apps/workspace-engine
./tools/seed/seed random resources 20  # Won't find tools/seed/.env

# Right: Run from the directory with .env
cd apps/workspace-engine/tools/seed
./seed random resources 20  # Will find ./.env

# Or: Specify custom env file path
./seed random resources 20 --env-file /path/to/.env
```

### Connection errors

Verify Kafka is running and accessible:

```bash
# Check if Kafka is running on default port
nc -zv localhost 9092

# Or specify a different server
seed random resources 20 --bootstrap-server kafka.example.com:9092
```
