# DTO Layer

This package provides a Data Transfer Object (DTO) layer that serves as an abstraction between protobuf types (`pkg/pb/proto`) and domain model types (`pkg/model`).

## Purpose

The DTO layer provides:
- **Decoupling**: Separates business logic from protobuf implementation details
- **Consistency**: Provides a stable API for JSON serialization and external interfaces
- **Type Safety**: Ensures proper data conversion between different representations
- **Testing**: Easier to test business logic with simple DTOs vs complex protobuf types

## Supported Types

The following entities have full DTO mapping support:

### Core Types
- **Resource**: Application resources with metadata, timestamps, and identifiers
- **ResourceSelector**: Selectors for filtering resources with conditions
- **Match**: Results from selector matching operations
- **Status**: Operation status with error information

### Reference Types
- **ResourceRef**: String-based resource references
- **ResourceSelectorRef**: String-based selector references

## Usage Examples

### Basic Conversion

```go
import "github.com/ctrlplanedev/selector-engine/pkg/mapping"

// Convert from protobuf to DTO
protoResource := &pb.Resource{Id: "123", Name: "My Resource"}
dtoResource := dto.FromProtoResource(protoResource)

// Convert from DTO to protobuf
backToProto := dto.ToProtoResource(dtoResource)

// Convert from model to DTO
modelResource := &model.Resource{ID: "123", Name: "My Resource"}
dtoResource = dto.FromModelResource(modelResource)
```

### Convenience Functions

```go
// Direct model ↔ protobuf conversion via DTO
proto := dto.ConvertModelToProto(modelResource)
model := dto.ConvertProtoToModel(protoResource)

// Batch conversions
dtoResources := dto.ConvertProtoResources(protoSlice)
protoResources := dto.ConvertDTOResources(dtoSlice)
```

### Reference Types

```go
// ResourceRef is just a string wrapper
ref := dto.ResourceRef("resource-123")
protoRef := dto.ToProtoResourceRef(ref)
backToString := string(dto.FromProtoResourceRef(protoRef))
```

### Working with Matches

```go
protoMatch := &pb.Match{
    Error: false,
    Message: "Resource matches selector",
    Resource: protoResource,
    Selector: protoSelector,
}

dtoMatch := dto.FromProtoMatch(protoMatch)
// Now you can work with clean DTO types
fmt.Printf("Match result: %s\n", dtoMatch.Message)
```

## Files Structure

- **`types.go`**: DTO type definitions
- **`protobuf_mappings.go`**: Protobuf ↔ DTO conversion functions
- **`model_mappings.go`**: Model ↔ DTO conversion functions  
- **`convenience.go`**: Helper functions for common operations
- **`dto_test.go`**: Comprehensive tests for all mappings

## Condition Handling

The `Condition` type in DTOs uses a simplified representation:

```go
type Condition struct {
    Type string      `json:"type"`
    Data interface{} `json:"data"`
}
```

For protobuf conditions, the data is serialized/deserialized as JSON. This provides flexibility while maintaining the ability to round-trip data between protobuf and DTO representations.

## Error Handling

All mapping functions handle nil inputs gracefully:
- Passing `nil` to any `FromProto*` function returns `nil`
- Passing `nil` to any `ToProto*` function returns `nil`
- Passing `nil` to any `FromModel*` function returns `nil`
- Passing `nil` to any `ToModel*` function returns `nil`

## Testing

Run the full test suite:

```bash
go test ./pkg/mapping -v
```

The tests cover:
- Basic type conversions in both directions
- Nested object handling
- Nil input handling
- Slice conversion utilities
- Round-trip conversion verification 