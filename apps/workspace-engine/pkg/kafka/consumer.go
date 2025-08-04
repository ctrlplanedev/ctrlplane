package kafka

import (
	"encoding/json"
	"os"
	"time"

	"workspace-engine/pkg/logger"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

const (
	GroupID = "workspace-engine"
	Topic   = "ctrlplane-events"
)

// Event represents the structure of events from your TypeScript code
type Event struct {
	WorkspaceID string                 `json:"workspaceId"`
	EventType   string                 `json:"eventType"`
	EventID     string                 `json:"eventId"`
	Timestamp   float64                `json:"timestamp"`
	Source      string                 `json:"source"`
	Payload     map[string]interface{} `json:"payload"`
}

func StartConsumer() {
	log := logger.Get()

	brokers := os.Getenv("KAFKA_BROKERS")
	if brokers == "" {
		brokers = "localhost:9092"
	}

	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": brokers,
		"group.id":          GroupID,
		"auto.offset.reset": "earliest",
	})

	if err != nil {
		log.Error("Failed to create consumer", "error", err)
		return
	}
	defer c.Close()

	err = c.SubscribeTopics([]string{Topic}, nil)
	if err != nil {
		log.Error("Failed to subscribe", "error", err)
		return
	}

	log.Info("Started Kafka consumer for ctrlplane-events")

	run := true
	for run {
		msg, err := c.ReadMessage(time.Second)

		if err != nil {
			if err.(kafka.Error).IsTimeout() {
				continue
			}
			log.Error("Consumer error", "error", err)
			continue
		}

		var event Event
		err = json.Unmarshal(msg.Value, &event)
		if err != nil {
			log.Error("Failed to unmarshal event", "error", err)
			continue
		}

		log.Info("Received event", "event", event)
	}
}
