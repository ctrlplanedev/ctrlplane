package producer

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// Configuration variables loaded from environment
var (
	Topic   = getEnv("KAFKA_TOPIC", "workspace-events")
	GroupID = getEnv("KAFKA_GROUP_ID", "workspace-engine")
	Brokers = getEnv("KAFKA_BROKERS", "localhost:9092")
)

// getEnv retrieves an environment variable or returns a default value
func getEnv(varName string, defaultValue string) string {
	v := os.Getenv(varName)
	if v == "" {
		return defaultValue
	}
	return v
}

// EventProducer defines the interface for producing events to Kafka
type EventProducer interface {
	ProduceEvent(eventType string, workspaceID string, data any) error
	Flush(timeoutMs int) int
	Close()
}

// Producer wraps a Kafka producer for sending events
type Producer struct {
	producer *kafka.Producer
	topic    string
}

// Ensure Producer implements EventProducer
var _ EventProducer = (*Producer)(nil)

// NewProducer creates a new Kafka producer
func NewProducer() (*Producer, error) {
	log.Info("Creating Kafka producer", "brokers", Brokers, "topic", Topic)

	p, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": Brokers,
		// Enable idempotence to prevent duplicate messages
		"enable.idempotence": true,
		// Compression for efficiency
		"compression.type": "snappy",
		// Retry configuration
		"message.send.max.retries": 10,
		"retry.backoff.ms":         100,
	})

	if err != nil {
		log.Error("Failed to create producer", "error", err)
		return nil, err
	}

	// Handle delivery reports in the background
	go func() {
		for e := range p.Events() {
			switch ev := e.(type) {
			case *kafka.Message:
				if ev.TopicPartition.Error != nil {
					log.Error("Failed to deliver message",
						"error", ev.TopicPartition.Error,
						"topic", *ev.TopicPartition.Topic,
						"partition", ev.TopicPartition.Partition)
				} else {
					log.Debug("Message delivered",
						"topic", *ev.TopicPartition.Topic,
						"partition", ev.TopicPartition.Partition,
						"offset", ev.TopicPartition.Offset)
				}
			}
		}
	}()

	return &Producer{
		producer: p,
		topic:    Topic,
	}, nil
}

// ProduceEvent sends an event to Kafka
// The workspaceID is used as the partition key to ensure all events for a workspace go to the same partition
func (p *Producer) ProduceEvent(eventType string, workspaceID string, data any) error {
	// Marshal data if provided
	var dataBytes []byte
	var err error
	if data != nil {
		dataBytes, err = json.Marshal(data)
		if err != nil {
			return fmt.Errorf("failed to marshal event data: %w", err)
		}
	}

	// Create event payload
	event := map[string]any{
		"eventType":   eventType,
		"workspaceId": workspaceID,
	}
	if dataBytes != nil {
		event["data"] = json.RawMessage(dataBytes)
	}

	// Marshal complete event
	eventBytes, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	// Produce to Kafka with workspace ID as key for consistent partitioning
	err = p.producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     &p.topic,
			Partition: kafka.PartitionAny,
		},
		Key:   []byte(workspaceID),
		Value: eventBytes,
	}, nil)

	if err != nil {
		return fmt.Errorf("failed to produce message: %w", err)
	}

	return nil
}

// Flush waits for all messages to be delivered
func (p *Producer) Flush(timeoutMs int) int {
	return p.producer.Flush(timeoutMs)
}

// Close closes the producer
func (p *Producer) Close() {
	// Wait for any outstanding messages to be delivered (with timeout)
	remaining := p.producer.Flush(5000)
	if remaining > 0 {
		log.Warn("Producer closed with messages still in queue", "remaining", remaining)
	}
	p.producer.Close()
	log.Info("Kafka producer closed")
}
