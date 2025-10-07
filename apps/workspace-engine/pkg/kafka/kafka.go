package kafka

import (
	"context"
	"os"
	"time"
	"workspace-engine/pkg/events"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

var (
	Topic   = getEnv("KAFKA_TOPIC", "workspace-events")
	GroupID = getEnv("KAFKA_GROUP_ID", "workspace-engine")
	Brokers = getEnv("KAFKA_BROKERS", "localhost:9092")
)

func getEnv(varName string, defaultValue string) string {
	v := os.Getenv(varName)
	if v == "" {
		return defaultValue
	}
	return v
}

func getAssignedPartitions(c *kafka.Consumer) (map[int32]struct{}, error) {
	asgn, err := c.Assignment()
	if err != nil {
		return nil, err
	}
	m := make(map[int32]struct{}, len(asgn))
	for _, tp := range asgn {
		m[tp.Partition] = struct{}{}
	}
	return m, nil
}

func getTopicPartitionCount(c *kafka.Consumer) (int, error) {
	md, err := c.GetMetadata(&Topic, false, 5000)
	if err != nil {
		return 0, err
	}
	return len(md.Topics[Topic].Partitions), nil
}

func populateWorkspaceCache(ctx context.Context, c *kafka.Consumer) error {
	assignedPartitions, err := getAssignedPartitions(c)
	if err != nil {
		return err
	}
	topicPartitionCount, err := getTopicPartitionCount(c)
	if err != nil {
		return err
	}
	if err := initWorkspaces(ctx, c, assignedPartitions, topicPartitionCount); err != nil {
		return err
	}
	return nil
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
	defer c.Close()

	err = c.SubscribeTopics([]string{Topic}, func(c *kafka.Consumer, e kafka.Event) error {
		switch e.(type) {
		case *kafka.AssignedPartitions:
			if err := populateWorkspaceCache(ctx, c); err != nil {
				log.Error("Failed to populate workspace cache", "error", err)
				return err
			}
		default:
			return nil
		}

		return nil
	})

	if err != nil {
		log.Error("Failed to subscribe", "error", err)
		return err
	}

	log.Info("Started Kafka consumer for ctrlplane-events")

	if err := populateWorkspaceCache(ctx, c); err != nil {
		log.Error("Failed to populate workspace cache", "error", err)
		return err
	}

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
				continue
			}
			log.Error("Consumer error", "error", err)
			continue
		}

		if err := handler.ListenAndRoute(ctx, msg); err != nil {
			log.Error("Failed to read message", "error", err)
			continue
		}

		c.CommitMessage(msg)
	}
}
