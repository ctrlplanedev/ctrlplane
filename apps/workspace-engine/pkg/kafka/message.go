package kafka

import (
	"time"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// handleReadError handles errors from reading Kafka messages
func handleReadError(err error) {
	if kafkaErr, ok := err.(kafka.Error); ok && kafkaErr.IsTimeout() {
		log.Debug("Timeout, continuing")
		time.Sleep(time.Second)
		return
	}
	log.Error("Consumer error", "error", err)
	time.Sleep(time.Second)
}
