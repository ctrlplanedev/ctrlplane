package kafka

import (
	"context"
	"fmt"
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
	topicMeta, ok := md.Topics[Topic]
	if !ok {
		return 0, fmt.Errorf("topic %s not found", Topic)
	}
	if topicMeta.Error.Code() != kafka.ErrNoError {
		return 0, fmt.Errorf("metadata error for topic %s: %w", Topic, topicMeta.Error)
	}
	if len(topicMeta.Partitions) == 0 {
		return 0, fmt.Errorf("topic %s has no partitions", Topic)
	}
	return len(topicMeta.Partitions), nil
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
	if err := initWorkspaces(ctx, assignedPartitions, topicPartitionCount); err != nil {
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
		switch ev := e.(type) {
		case *kafka.AssignedPartitions:
			if err := c.Assign(ev.Partitions); err != nil {
				log.Error("Failed to assign partitions", "error", err)
				return err
			}
			if err := populateWorkspaceCache(ctx, c); err != nil {
				log.Error("Failed to populate workspace cache", "error", err)
				return err
			}
		case *kafka.RevokedPartitions:
			if err := c.Unassign(); err != nil {
				log.Error("Failed to unassign partitions", "error", err)
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
