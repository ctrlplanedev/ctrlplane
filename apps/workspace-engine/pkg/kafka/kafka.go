package kafka

import (
	"context"
	"os"
	"time"
	"workspace-engine/pkg/events"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"go.opentelemetry.io/otel"
)

var (
	Topic   = getEnv("KAFKA_TOPIC", "workspace-events")
	GroupID = getEnv("KAFKA_GROUP_ID", "workspace-engine")
	Brokers = getEnv("KAFKA_BROKERS", "localhost:9092")

	tracer = otel.Tracer("kafka")
)

func getEnv(varName string, defaultValue string) string {
	v := os.Getenv(varName)
	if v == "" {
		return defaultValue
	}
	return v
}

func RunConsumer(ctx context.Context) error {
	log.Info("Connecting to Kafka", "brokers", Brokers)
	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers":  Brokers,
		"group.id":           GroupID,
		"auto.offset.reset":  "earliest",
		"enable.auto.commit": false,
	})

	if err != nil {
		log.Error("Failed to create consumer", "error", err)
		return err
	}
	defer func() { _ = c.Close() }()

	err = c.SubscribeTopics([]string{Topic}, nil)

	if err != nil {
		log.Error("Failed to subscribe", "error", err)
		return err
	}

	log.Info("Started Kafka consumer for ctrlplane-events")
	handler := events.NewEventHandler()

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
				log.Debug("Timeout, continuing")
				time.Sleep(time.Second)
				continue
			}
			log.Error("Consumer error", "error", err)
			time.Sleep(time.Second)
			continue
		}

		ws, err := handler.ListenAndRoute(ctx, msg)
		if err != nil {
			log.Error("Failed to read message", "error", err)
			continue
		}

		if _, err := c.CommitMessage(msg); err != nil {
			log.Error("Failed to commit message", "error", err)
			continue
		}

		ws.KafkaProgress.FromMessage(msg)
	}
}
