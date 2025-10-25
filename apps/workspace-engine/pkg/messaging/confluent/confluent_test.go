package confluent

import (
	"testing"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/stretchr/testify/assert"
)

func TestNewConfluent(t *testing.T) {
	c := NewConfluent("localhost:9092")
	assert.NotNil(t, c)
	assert.Equal(t, "localhost:9092", c.brokers)
}

func TestProducerCreation(t *testing.T) {
	// Skip if no Kafka available
	t.Skip("Skipping test - requires running Kafka instance")

	c := NewConfluent("localhost:9092")
	producer, err := c.CreateProducer("test-topic", nil)
	
	assert.NoError(t, err)
	assert.NotNil(t, producer)
	
	if producer != nil {
		producer.Close()
	}
}

func TestConsumerCreation(t *testing.T) {
	// Skip if no Kafka available
	t.Skip("Skipping test - requires running Kafka instance")

	c := NewConfluent("localhost:9092")
	consumer, err := c.CreateConsumer("test-group", nil)
	
	assert.NoError(t, err)
	assert.NotNil(t, consumer)
	
	if consumer != nil {
		consumer.Close()
	}
}

func TestProducerWithConfig(t *testing.T) {
	// Skip if no Kafka available
	t.Skip("Skipping test - requires running Kafka instance")

	c := NewConfluent("localhost:9092")
	config := &kafka.ConfigMap{
		"compression.type": "lz4",
	}	
	
	producer, err := c.CreateProducer("test-topic", config)
	
	assert.NoError(t, err)
	assert.NotNil(t, producer)
	
	if producer != nil {
		producer.Close()
	}
}

func TestConsumerWithConfig(t *testing.T) {
	// Skip if no Kafka available
	t.Skip("Skipping test - requires running Kafka instance")

	c := NewConfluent("localhost:9092")
	config := &kafka.ConfigMap{
		"auto.offset.reset": "latest",
	}
	
	consumer, err := c.CreateConsumer("test-group", config)
	
	assert.NoError(t, err)
	assert.NotNil(t, consumer)
	
	if consumer != nil {
		consumer.Close()
	}
}

// TestProducerConsumerIntegration tests the full producer-consumer flow
func TestProducerConsumerIntegration(t *testing.T) {
	// Skip if no Kafka available
	t.Skip("Skipping integration test - requires running Kafka instance")

	brokers := "localhost:9092"
	topic := "test-integration-topic"
	groupID := "test-integration-group"

	// Create producer
	producer, err := NewProducer(brokers, topic, nil)
	assert.NoError(t, err)
	defer producer.Close()

	// Create consumer
	consumer, err := NewConsumer(brokers, groupID, nil)
	assert.NoError(t, err)
	defer consumer.Close()

	// Subscribe to topic
	err = consumer.Subscribe(topic)
	assert.NoError(t, err)

	// Publish a message
	testKey := []byte("test-key")
	testValue := []byte("test-value")
	err = producer.Publish(testKey, testValue)
	assert.NoError(t, err)

	// Flush to ensure message is sent
	remaining := producer.Flush(5000)
	assert.Equal(t, 0, remaining)

	// Read message
	msg, err := consumer.ReadMessage(5 * time.Second)
	assert.NoError(t, err)
	assert.NotNil(t, msg)
	
	if msg != nil {
		assert.Equal(t, testKey, msg.Key)
		assert.Equal(t, testValue, msg.Value)
		
		// Commit message
		err = consumer.CommitMessage(msg)
		assert.NoError(t, err)
	}
}

