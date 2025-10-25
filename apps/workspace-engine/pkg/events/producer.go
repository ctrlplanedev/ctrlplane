package events

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/pkg/events/handler"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// EventProducer defines the interface for producing events.
// This interface allows both Kafka-based and in-memory implementations.
type EventProducer interface {
	ProduceEvent(eventType string, workspaceID string, data any) error
}

// Ensure kafka.Producer implements EventProducer (it has extra methods but that's ok)
// var _ EventProducer = (*kafka.Producer)(nil) // Can't do this directly, but kafka.Producer from kafka package implements this

// InMemoryProducer is an in-memory event producer for testing.
// It uses a channel-based queue to process events asynchronously in order,
// avoiding recursive deadlocks when events trigger other events.
type InMemoryProducer struct {
	handler       MemoryHandler
	ctx           context.Context
	eventQueue    chan *kafka.Message
	offset        int64
	processingDone chan struct{}
}

type MemoryHandler func(ctx context.Context, msg *kafka.Message, offsetTracker handler.OffsetTracker) error

// NewInMemoryProducer creates a new in-memory producer for testing.
// It starts a background goroutine that processes events from the queue.
func NewInMemoryProducer(ctx context.Context, handler MemoryHandler) *InMemoryProducer {
	p := &InMemoryProducer{
		handler:        handler,
		ctx:            ctx,
		eventQueue:     make(chan *kafka.Message, 1000), // Buffered channel for events
		offset:         0,
		processingDone: make(chan struct{}),
	}

	// Start background processor
	go p.processEvents()

	return p
}

// processEvents continuously processes events from the queue.
func (p *InMemoryProducer) processEvents() {
	for msg := range p.eventQueue {
		offsetTracker := handler.OffsetTracker{
			LastCommittedOffset: 0,
			LastWorkspaceOffset: 0,
			MessageOffset:       int64(msg.TopicPartition.Offset),
		}

		// Process the event
		if err := p.handler(p.ctx, msg, offsetTracker); err != nil {
			// In tests, we might want to handle this differently
			// For now, just continue processing
			continue
		}
	}
	close(p.processingDone)
}

// ProduceEvent queues an event for asynchronous processing.
func (p *InMemoryProducer) ProduceEvent(eventType string, workspaceID string, data any) error {
	// Marshal data if provided
	var dataBytes []byte
	var err error
	if data != nil {
		dataBytes, err = json.Marshal(data)
		if err != nil {
			return fmt.Errorf("failed to marshal event data: %w", err)
		}
	}

	// Create raw event
	rawEvent := handler.RawEvent{
		EventType:   handler.EventType(eventType),
		WorkspaceID: workspaceID,
		Data:        dataBytes,
		Timestamp:   time.Now().UnixNano(),
	}

	// Marshal the full event
	eventBytes, err := json.Marshal(rawEvent)
	if err != nil {
		return fmt.Errorf("failed to marshal raw event: %w", err)
	}

	// Increment offset for this message
	p.offset++
	currentOffset := kafka.Offset(p.offset)

	// Create a mock Kafka message
	topic := "test-topic"
	partition := int32(0)

	msg := &kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     &topic,
			Partition: partition,
			Offset:    currentOffset,
		},
		Value: eventBytes,
	}

	// Queue the event for processing
	p.eventQueue <- msg

	return nil
}

// Flush waits for all queued events to be processed.
// This is useful in tests to ensure all events have been handled before making assertions.
func (p *InMemoryProducer) Flush() {
	// Send a sentinel value by closing and reopening the queue would be complex
	// Instead, we'll use a simpler approach: wait until the queue is empty
	for len(p.eventQueue) > 0 {
		time.Sleep(1 * time.Millisecond)
	}
	// Give a bit more time for the last event to finish processing
	time.Sleep(10 * time.Millisecond)
}

// Close stops the event processor and waits for it to finish.
func (p *InMemoryProducer) Close() {
	close(p.eventQueue)
	<-p.processingDone
}

