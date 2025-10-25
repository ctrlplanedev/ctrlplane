package confluent

import (
	"fmt"

	"workspace-engine/pkg/messaging"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// Producer is a Confluent Kafka implementation of messaging.Producer
type Producer struct {
	producer *kafka.Producer
	topic    string
	closed   bool
}

// Ensure Producer implements messaging.Producer
var _ messaging.Producer = (*Producer)(nil)

// NewProducer creates a new Confluent Kafka producer
func NewProducer(brokers string, topic string, config *kafka.ConfigMap) (*Producer, error) {
	log.Info("Creating Confluent Kafka producer", "brokers", brokers, "topic", topic)

	// Default configuration
	if config == nil {
		return nil, fmt.Errorf("config is nil")
	}

	// Ensure bootstrap.servers is set
	if _, exists := (*config)["bootstrap.servers"]; !exists {
		return nil, fmt.Errorf("bootstrap.servers is not set in config")
	}

	p, err := kafka.NewProducer(config)
	if err != nil {
		log.Error("Failed to create Confluent Kafka producer", "error", err)
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
		topic:    topic,
		closed:   false,
	}, nil
}

// Publish publishes a message to the topic
func (p *Producer) Publish(key []byte, value []byte) error {
	if p.closed {
		return fmt.Errorf("producer is closed")
	}

	err := p.producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     &p.topic,
			Partition: kafka.PartitionAny,
		},
		Key:   key,
		Value: value,
	}, nil)

	if err != nil {
		return fmt.Errorf("failed to produce message: %w", err)
	}

	log.Debug("Message published", "key", string(key), "valueSize", len(value))
	return nil
}

// Flush waits for all pending messages to be delivered
// Returns the number of messages still pending after timeout
func (p *Producer) Flush(timeoutMs int) int {
	remaining := p.producer.Flush(timeoutMs)
	log.Debug("Producer flushed", "remaining", remaining)
	return remaining
}

// Close closes the producer and releases resources
func (p *Producer) Close() error {
	if p.closed {
		return nil
	}

	// Wait for any outstanding messages to be delivered (with timeout)
	remaining := p.producer.Flush(5000)
	if remaining > 0 {
		log.Warn("Producer closed with messages still in queue", "remaining", remaining)
	}

	p.producer.Close()
	p.closed = true
	log.Info("Confluent Kafka producer closed")
	return nil
}

