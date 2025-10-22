package kafka

import (
	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// createConsumer initializes a new Kafka consumer with the configured settings
func createConsumer() (*kafka.Consumer, error) {
	log.Info("Connecting to Kafka", "brokers", Brokers)

	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers":               Brokers,
		"group.id":                        GroupID,
		"auto.offset.reset":               "earliest",
		"enable.auto.commit":              false,
		"partition.assignment.strategy":   "cooperative-sticky",
		"session.timeout.ms":              10000,
		"heartbeat.interval.ms":           3000,
		"go.application.rebalance.enable": true, // Enable rebalance callbacks
	})

	if err != nil {
		log.Error("Failed to create consumer", "error", err)
		return nil, err
	}

	return c, nil
}
