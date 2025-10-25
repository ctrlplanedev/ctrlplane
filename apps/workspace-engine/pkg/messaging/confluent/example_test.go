package confluent_test

import (
	"log"
	"time"

	"workspace-engine/pkg/messaging/confluent"
)

func Example_basicUsage() {
	// Create a Confluent factory
	c := confluent.NewConfluent("localhost:9092")

	// Create a producer
	producer, err := c.CreateProducer("my-topic", nil)
	if err != nil {
		log.Fatal(err)
	}
	defer producer.Close()

	// Publish a message
	key := []byte("user-123")
	value := []byte(`{"event": "user.created", "data": {"name": "John"}}`)
	if err := producer.Publish(key, value); err != nil {
		log.Fatal(err)
	}

	// Flush to ensure message is sent
	producer.Flush(5000)
}

func Example_consumer() {
	// Create a Confluent factory
	c := confluent.NewConfluent("localhost:9092")

	// Create a consumer
	consumer, err := c.CreateConsumer("my-consumer-group", nil)
	if err != nil {
		log.Fatal(err)
	}
	defer consumer.Close()

	// Subscribe to topic
	if err := consumer.Subscribe("my-topic"); err != nil {
		log.Fatal(err)
	}

	// Read messages
	for i := 0; i < 10; i++ {
		msg, err := consumer.ReadMessage(5 * time.Second)
		if err != nil {
			log.Printf("Error: %v", err)
			continue
		}

		if msg == nil {
			// Timeout - no message available
			continue
		}

		// Process message
		log.Printf("Key: %s, Value: %s", string(msg.Key), string(msg.Value))

		// Commit offset
		if err := consumer.CommitMessage(msg); err != nil {
			log.Printf("Failed to commit: %v", err)
		}
	}
}

func Example_advancedConsumer() {
	// Create a Confluent factory
	c := confluent.NewConfluent("localhost:9092")

	// Create a consumer
	consumer, err := c.CreateConsumer("my-consumer-group", nil)
	if err != nil {
		log.Fatal(err)
	}
	defer consumer.Close()

	// Subscribe to topic
	if err := consumer.Subscribe("my-topic"); err != nil {
		log.Fatal(err)
	}

	// Get partition information
	partitions, _ := consumer.GetAssignedPartitions()
	log.Printf("Assigned partitions: %v", partitions)

	count, _ := consumer.GetPartitionCount()
	log.Printf("Total partitions: %d", count)

	// Get committed offset for partition 0
	offset, _ := consumer.GetCommittedOffset(0)
	log.Printf("Last committed offset for partition 0: %d", offset)

	// Seek to a specific offset
	if err := consumer.SeekToOffset(0, 100); err != nil {
		log.Printf("Failed to seek: %v", err)
	}
}

