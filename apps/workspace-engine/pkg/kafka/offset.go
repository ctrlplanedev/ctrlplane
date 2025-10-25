package kafka

import (
	"fmt"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// extractPartitionNumbers converts Kafka TopicPartition array to simple partition number array
func extractPartitionNumbers(assignment []kafka.TopicPartition) []int32 {
	partitions := make([]int32, len(assignment))
	for i, tp := range assignment {
		partitions[i] = tp.Partition
	}
	return partitions
}

// getTopicPartitionCount queries Kafka metadata to find total number of partitions for the topic
func getTopicPartitionCount(c *kafka.Consumer) (int32, error) {
	metadata, err := c.GetMetadata(&Topic, false, 5000)
	if err != nil {
		return 0, fmt.Errorf("failed to get topic metadata: %w", err)
	}

	topicMetadata, ok := metadata.Topics[Topic]
	if !ok {
		return 0, fmt.Errorf("topic %s not found in metadata", Topic)
	}

	numPartitions := int32(len(topicMetadata.Partitions))
	log.Info("Topic partition count", "topic", Topic, "partitions", numPartitions)

	return numPartitions, nil
}

// getCommittedOffset retrieves the last committed offset for a partition
func getCommittedOffset(consumer *kafka.Consumer, partition int32) (int64, error) {
	partitions := []kafka.TopicPartition{
		{
			Topic:     &Topic,
			Partition: partition,
			Offset:    kafka.OffsetStored, // This fetches the committed offset
		},
	}

	committed, err := consumer.Committed(partitions, 5000)
	if err != nil {
		return int64(kafka.OffsetInvalid), err
	}

	if len(committed) == 0 || committed[0].Offset == kafka.OffsetInvalid {
		// No committed offset yet, this is the beginning
		return int64(kafka.OffsetBeginning), nil
	}

	return int64(committed[0].Offset), nil
}
