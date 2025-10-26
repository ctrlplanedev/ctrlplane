package kafka

import (
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/messaging/confluent"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

func NewProducer(brokers string) (messaging.Producer, error) {
	return confluent.NewConfluent(brokers).CreateProducer(Topic, &kafka.ConfigMap{
		"bootstrap.servers":        Brokers,
		"enable.idempotence":       true,
		"compression.type":         "snappy",
		"message.send.max.retries": 10,
		"retry.backoff.ms":         100,

		// "debug": "cgrp,broker,protocol",
	})
}
