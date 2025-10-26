package confluent

import (
	"workspace-engine/pkg/messaging"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// Confluent provides factory methods for creating Confluent Kafka-based messaging components
type Confluent struct {
	brokers string
}

// NewConfluent creates a new Confluent factory with the given broker addresses
func NewConfluent(brokers string) *Confluent {
	return &Confluent{
		brokers: brokers,
	}
}

// CreateProducer creates a new Confluent Kafka producer with custom configuration
func (c *Confluent) CreateProducer(topic string, config *kafka.ConfigMap) (messaging.Producer, error) {
	return NewProducer(c.brokers, topic, config)
}

// CreateConsumer creates a new Confluent Kafka consumer with custom configuration
func (c *Confluent) CreateConsumer(groupID string, topic string, config *kafka.ConfigMap) (messaging.Consumer, error) {
	return NewConsumer(c.brokers, groupID, topic, config)
}
