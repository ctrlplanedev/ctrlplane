# Claude Code Guidelines for This Project

## Project Structure

```
selector-engine/
├── cmd/                    # Application entry points
│   ├── client/            # Client CLI application
│   └── server/            # gRPC server application
├── pkg/                    # Go packages
│   ├── client/            # Client implementation
│   ├── server/            # Server implementation
│   ├── engine/            # Core selector engine logic
│   │   └── pure_go/       # Pure Go implementation
│   ├── model/             # Data models
│   │   ├── resource/      # Resource definitions
│   │   └── selector/      # Selector conditions and types
│   ├── mapping/           # Protobuf <-> Model conversions
│   └── pb/proto/          # Generated protobuf code
├── proto/                  # Protocol buffer definitions
├── Dockerfile.client       # Client container image
├── Dockerfile.server       # Server container image
└── Makefile               # Build automation
```

## Architecture Overview

- **Engine**: Core matching logic with sequential and parallel implementations
- **Model**: Domain models for resources, selectors, and conditions
- **Mapping**: Bidirectional conversion between protobuf and internal models
- **Server/Client**: gRPC implementations with bidirectional streaming

## Code Style Guidelines

### Comments
- **DO NOT** add extraneous inline comments that state the obvious
- **DO NOT** add comments that simply restate what the code does
- **DO NOT** add comments for standard Go patterns (e.g., "// Semaphore for limiting concurrent operations", "// WaitGroup to track active workers")

Examples of comments to avoid:
```go
// BAD - States the obvious
// Process resources in batches
for i := 0; i < len(resources); i += MaxBatchSize {

// BAD - Restates what the code does
// Close send side
stream.CloseSend()

// BAD - Standard Go pattern
var wg sync.WaitGroup  // WaitGroup to track active workers
```

Good comments should:
- Explain **why** something is done, not **what** is done
- Document complex business logic or algorithms
- Provide context that isn't obvious from the code
- Include TODO/FIXME notes for future work
- Document exported functions/types/methods

### Testing
When running tests, always check for and run any lint/typecheck commands if they exist:
- Look for scripts like `npm run lint`, `npm run typecheck`
- Check for Go linters like `golangci-lint`
- Run `go vet` and `go fmt` for Go projects

### Code Conventions
- Follow existing patterns in the codebase
- Check existing files for style conventions before adding new code
- Preserve exact indentation when editing files
- Never include line numbers when making edits

## Development Guidelines

### Adding New Condition Types

1. Create a new condition struct in `pkg/model/selector/` implementing the `Condition` interface
2. Add the condition type to `types.go`
3. Update the protobuf definitions in `proto/condition.proto`
4. Regenerate protobuf code: `make proto`
5. Add mapping functions in `pkg/mapping/protobuf_mappings.go`
6. Write comprehensive tests following the data-driven pattern

### Engine Implementation Notes

- The `GoDispatcherEngine` provides sequential processing
- The `GoParallelDispatcherEngine` adds parallel processing with configurable concurrency
- Both engines share the same core logic through composition
- Backpressure is implemented using semaphores in the parallel engine

### Testing Patterns

- Use table-driven tests for all condition types
- Include edge cases: empty values, special characters, unicode
- Test both validation and matching logic separately
- Follow the existing test structure in `*_test.go` files

### Common Tasks

- **Run all tests**: `go test ./...`
- **Run specific package tests**: `go test ./pkg/model/selector`
- **Format code**: `go fmt ./...`
- **Lint code**: `golangci-lint run` (if installed)
- **Update dependencies**: `go mod tidy`

### Performance Considerations

- The parallel engine uses a semaphore pattern for backpressure
- Default max parallel calls is 10 (configurable)
- Streaming design allows processing large datasets without loading everything into memory
- Channel-based interfaces enable efficient pipelining