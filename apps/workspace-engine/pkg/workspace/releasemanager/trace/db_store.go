package trace

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel/attribute"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// DBStore implements PersistenceStore for PostgreSQL
type DBStore struct {
	pool *pgxpool.Pool
}

// NewDBStore creates a new database persistence store
func NewDBStore(pool *pgxpool.Pool) *DBStore {
	return &DBStore{pool: pool}
}

// WriteSpans persists spans to the deployment_trace_span table
func (s *DBStore) WriteSpans(ctx context.Context, spans []sdktrace.ReadOnlySpan) error {
	if len(spans) == 0 {
		return nil
	}

	// Validate all spans before attempting database operations
	for _, span := range spans {
		if err := validateSpan(span); err != nil {
			return err
		}
	}

	// Get connection from pool
	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("failed to acquire connection: %w", err)
	}
	defer conn.Release()

	// Begin transaction
	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Prepare batch insert
	batch := &pgx.Batch{}

	for _, span := range spans {
		// Extract OTel identifiers
		traceID := span.SpanContext().TraceID().String()
		spanID := span.SpanContext().SpanID().String()
		var parentSpanID *string
		if span.Parent().IsValid() {
			pid := span.Parent().SpanID().String()
			parentSpanID = &pid
		}

		// Extract ctrlplane-specific attributes from span
		var (
			phase            *string
			nodeType         *string
			status           *string
			workspaceID      string // Required field
			releaseTargetKey *string
			releaseID        *string
			jobID            *string
			parentTraceID    *string
			depth            *int
			sequence         *int
		)

		// Collect all attributes for JSONB storage
		allAttributes := make(map[string]interface{})

		for _, attr := range span.Attributes() {
			key := string(attr.Key)
			value := attributeValueToInterface(attr.Value)
			allAttributes[key] = value

			// Extract known ctrlplane attributes
			switch key {
			case attrPhase:
				v := attr.Value.AsString()
				phase = &v
			case attrNodeType:
				v := attr.Value.AsString()
				nodeType = &v
			case attrStatus:
				v := attr.Value.AsString()
				status = &v
			case attrWorkspaceID:
				workspaceID = attr.Value.AsString()
			case attrReleaseTarget:
				v := attr.Value.AsString()
				releaseTargetKey = &v
			case attrReleaseID:
				v := attr.Value.AsString()
				releaseID = &v
			case attrJobID:
				v := attr.Value.AsString()
				jobID = &v
			case attrParentTraceID:
				v := attr.Value.AsString()
				parentTraceID = &v
			case attrDepth:
				v := int(attr.Value.AsInt64())
				depth = &v
			case attrSequence:
				v := int(attr.Value.AsInt64())
				sequence = &v
			}
		}

		// Serialize attributes to JSON
		attributesJSON, err := json.Marshal(allAttributes)
		if err != nil {
			return fmt.Errorf("failed to marshal attributes: %w", err)
		}

		// Extract and serialize events
		events := make([]map[string]any, 0)
		for _, event := range span.Events() {
			eventAttrs := make(map[string]any)
			for _, attr := range event.Attributes {
				eventAttrs[string(attr.Key)] = attributeValueToInterface(attr.Value)
			}

			eventData := map[string]any{
				"name":       event.Name,
				"timestamp":  event.Time.Format(time.RFC3339Nano),
				"attributes": eventAttrs,
			}
			events = append(events, eventData)
		}

		eventsJSON, err := json.Marshal(events)
		if err != nil {
			return fmt.Errorf("failed to marshal events: %w", err)
		}

		// Add insert to batch
		batch.Queue(`
			INSERT INTO deployment_trace_span (
				trace_id, span_id, parent_span_id, name,
				start_time, end_time,
				workspace_id, release_target_key, release_id, job_id, parent_trace_id,
				phase, node_type, status,
				depth, sequence,
				attributes, events
			) VALUES (
				$1, $2, $3, $4,
				$5, $6,
				$7, $8, $9, $10, $11,
				$12, $13, $14,
				$15, $16,
				$17, $18
			)
		`,
			traceID, spanID, parentSpanID, span.Name(),
			span.StartTime(), nullableTime(span.EndTime()),
			workspaceID, releaseTargetKey, releaseID, jobID, parentTraceID,
			phase, nodeType, status,
			depth, sequence,
			attributesJSON, eventsJSON,
		)
	}

	// Execute batch
	results := tx.SendBatch(ctx, batch)

	// Process batch results
	for range spans {
		_, err := results.Exec()
		if err != nil {
			results.Close()
			return fmt.Errorf("failed to insert span: %w", err)
		}
	}

	// Close batch results before committing
	if err := results.Close(); err != nil {
		return fmt.Errorf("failed to close batch results: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// attributeValueToInterface converts OTel attribute value to Go interface{}
func attributeValueToInterface(value attribute.Value) interface{} {
	switch value.Type() {
	case attribute.BOOL:
		return value.AsBool()
	case attribute.INT64:
		return value.AsInt64()
	case attribute.FLOAT64:
		return value.AsFloat64()
	case attribute.STRING:
		return value.AsString()
	case attribute.BOOLSLICE:
		return value.AsBoolSlice()
	case attribute.INT64SLICE:
		return value.AsInt64Slice()
	case attribute.FLOAT64SLICE:
		return value.AsFloat64Slice()
	case attribute.STRINGSLICE:
		return value.AsStringSlice()
	default:
		return value.AsString()
	}
}

// nullableTime converts zero time to nil for database NULL
func nullableTime(t time.Time) interface{} {
	if t.IsZero() {
		return nil
	}
	return t
}

// validateSpan checks that a span has all required attributes for database insertion
func validateSpan(span sdktrace.ReadOnlySpan) error {
	traceID := span.SpanContext().TraceID().String()
	spanID := span.SpanContext().SpanID().String()

	// Check for required workspace_id attribute
	hasWorkspaceID := false
	workspaceID := ""

	for _, attr := range span.Attributes() {
		if string(attr.Key) == attrWorkspaceID {
			hasWorkspaceID = true
			workspaceID = attr.Value.AsString()
			break
		}
	}

	if !hasWorkspaceID || workspaceID == "" {
		return fmt.Errorf("span %q (trace_id=%s, span_id=%s) is missing required attribute %q",
			span.Name(), traceID, spanID, attrWorkspaceID)
	}

	return nil
}
