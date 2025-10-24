# Workspace Snapshot Inspector

A CLI tool to inspect and explore gob-encoded workspace snapshot files.

## Quick Start

```bash
# From the workspace-engine directory
cd /Users/adityachoudhari/Documents/ctrlplane/apps/workspace-engine

# Show summary info
go run tools/inspect/main.go info ~/Downloads/snapshot.gob

# View specific parts
go run tools/inspect/main.go deployments ~/Downloads/snapshot.gob
go run tools/inspect/main.go release-targets ~/Downloads/snapshot.gob
go run tools/inspect/main.go systems ~/Downloads/snapshot.gob
```

## Commands

### `info` - Show Summary

Get a quick overview of what's in the snapshot without dumping all the data:

```bash
go run tools/inspect/main.go info <snapshot-file>
```

Example output:

```
Workspace ID: abc-123

Store Contents:
  Systems:           2
  Environments:      5
  Deployments:       10
  Resources:         150
  Release Targets:   300
  ...
```

### Individual Store Commands

Inspect specific parts of the workspace state:

```bash
# Systems
go run tools/inspect/main.go systems <snapshot-file>

# Environments
go run tools/inspect/main.go environments <snapshot-file>

# Deployments
go run tools/inspect/main.go deployments <snapshot-file>

# Resources
go run tools/inspect/main.go resources <snapshot-file>

# Releases
go run tools/inspect/main.go releases <snapshot-file>

# Release Targets
go run tools/inspect/main.go release-targets <snapshot-file>

# Jobs
go run tools/inspect/main.go jobs <snapshot-file>

# Job Agents
go run tools/inspect/main.go job-agents <snapshot-file>

# Policies
go run tools/inspect/main.go policies <snapshot-file>

# Resource Providers
go run tools/inspect/main.go resource-providers <snapshot-file>
```

### `all` - Show Everything

Dump the entire workspace state as JSON:

```bash
go run tools/inspect/main.go all <snapshot-file>
```

## Flags

### `--verbose` or `-v`

Show additional information like file size, item counts:

```bash
go run tools/inspect/main.go deployments ~/Downloads/snapshot.gob -v
```

## Building

To build a standalone binary:

```bash
cd /Users/adityachoudhari/Documents/ctrlplane/apps/workspace-engine
go build -o bin/inspect tools/inspect/main.go

# Then use it directly
./bin/inspect info ~/Downloads/snapshot.gob
./bin/inspect deployments ~/Downloads/snapshot.gob
```

## Examples

```bash
# Get a quick summary
go run tools/inspect/main.go info ~/Downloads/prod-snapshot.gob

# View all deployments
go run tools/inspect/main.go deployments ~/Downloads/prod-snapshot.gob

# View release targets with verbose output
go run tools/inspect/main.go release-targets ~/Downloads/prod-snapshot.gob -v

# Pipe to jq for filtering
go run tools/inspect/main.go resources ~/Downloads/prod-snapshot.gob | jq '.[] | select(.name | contains("prod"))'

# Count resources
go run tools/inspect/main.go resources ~/Downloads/prod-snapshot.gob | jq 'length'

# Save output to file
go run tools/inspect/main.go deployments ~/Downloads/prod-snapshot.gob > deployments.json
```

## Output Format

All commands output valid JSON, making it easy to pipe to tools like `jq` for filtering and analysis.
