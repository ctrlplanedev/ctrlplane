package kafka

import (
	"context"
	"os"
	"time"

	"workspace-engine/pkg/events"
	"workspace-engine/pkg/logger"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

const (
	GroupID = "workspace-engine"
	Topic   = "ctrlplane-events"
)

func RunConsumer(ctx context.Context) error {
	log := logger.Get()

	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		brokers = "localhost:9092"
	}

	log.Info("Connecting to Kafka", "brokers", brokers)
	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers":  brokers,
		"group.id":           GroupID,
		"auto.offset.reset":  "earliest",
		"enable.auto.commit": false,
	})

	if err != nil {
		log.Error("Failed to create consumer", "error", err)
		return err
	}
	defer c.Close()

	err = c.SubscribeTopics([]string{Topic}, nil)
	if err != nil {
		log.Error("Failed to subscribe", "error", err)
		return err
	}

	log.Info("Started Kafka consumer for ctrlplane-events")

	reader := events.NewEventHandler()

	for {
		select {
		case <-ctx.Done():
			log.Info("Context cancelled, stopping consumer")
			return nil
		default:
		}

		msg, err := c.ReadMessage(time.Second)

		if err != nil {
			if err.(kafka.Error).IsTimeout() {
				continue
			}
			log.Error("Consumer error", "error", err)
			continue
		}

		if err := reader.ListenAndRoute(ctx, msg); err != nil {
			log.Error("Failed to read message", "error", err)
			continue
		}

		// NOTE: we do not commit the message. if the process ends and we need to rebuild the state,
		// we need to start from the beginning of the topic.
	}
}
