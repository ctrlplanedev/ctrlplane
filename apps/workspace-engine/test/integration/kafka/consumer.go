package kafka

import (
	"sync"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/stretchr/testify/mock"
)

var defaultTopic = "workspace-events"

type ConsumerMock struct {
	*mock.Mock

	queue              *MessageQueue
	mu                 sync.Mutex
	subscribed         []string
	assignedPartitions []kafka.TopicPartition
	committedOffsets   map[int32]kafka.Offset
	offsetPositions    map[int32]kafka.Offset
}

func NewConsumerMock(queue *MessageQueue) *ConsumerMock {
	return &ConsumerMock{
		queue:              queue,
		subscribed:         []string{},
		assignedPartitions: []kafka.TopicPartition{},
		committedOffsets:   make(map[int32]kafka.Offset),
		offsetPositions:    make(map[int32]kafka.Offset),
	}
}

func (c *ConsumerMock) Close() error {
	return nil
}

func (c *ConsumerMock) GetMetadata(topic *string, allTopics bool, timeoutMs int) (*kafka.Metadata, error) {
	// Return mock metadata with single partition
	topicName := defaultTopic
	if topic != nil {
		topicName = *topic
	}
	
	return &kafka.Metadata{
		Topics: map[string]kafka.TopicMetadata{
			topicName: {
				Topic: topicName,
				Partitions: []kafka.PartitionMetadata{
					{
						ID:       0,
						Leader:   1,
						Replicas: []int32{1},
						Isrs:     []int32{1},
					},
				},
			},
		},
	}, nil
}

func (c *ConsumerMock) SubscribeTopics(topics []string, rebalanceCb kafka.RebalanceCb) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.subscribed = topics
	return nil
}

func (c *ConsumerMock) Subscription() ([]string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.subscribed, nil
}

func (c *ConsumerMock) Assignment() ([]kafka.TopicPartition, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.assignedPartitions, nil
}

func (c *ConsumerMock) Poll(timeoutMs int) kafka.Event {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	// If not yet assigned and subscribed, trigger assignment
	if len(c.assignedPartitions) == 0 && len(c.subscribed) > 0 {
		// Assign partition 0 for all subscribed topics
		partitions := make([]kafka.TopicPartition, 0, len(c.subscribed))
		for _, topic := range c.subscribed {
			topicCopy := topic
			partitions = append(partitions, kafka.TopicPartition{
				Topic:     &topicCopy,
				Partition: 0,
				Offset:    kafka.OffsetBeginning,
			})
		}
		return kafka.AssignedPartitions{Partitions: partitions}
	}
	
	// Return nil if already assigned (normal polling)
	return nil
}

func (c *ConsumerMock) ReadMessage(timeout time.Duration) (*kafka.Message, error) {
	return c.queue.Pop(timeout)
}

func (c *ConsumerMock) Seek(partition kafka.TopicPartition, ignoredTimeoutMs int) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.offsetPositions[partition.Partition] = partition.Offset
	return nil
}

func (c *ConsumerMock) CommitMessage(msg *kafka.Message) ([]kafka.TopicPartition, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	// Store committed offset
	c.committedOffsets[msg.TopicPartition.Partition] = msg.TopicPartition.Offset
	
	// Return the committed partition
	return []kafka.TopicPartition{msg.TopicPartition}, nil
}

func (c *ConsumerMock) Committed(partitions []kafka.TopicPartition, timeoutMs int) ([]kafka.TopicPartition, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	result := make([]kafka.TopicPartition, len(partitions))
	for i, p := range partitions {
		result[i] = p
		if offset, ok := c.committedOffsets[p.Partition]; ok {
			result[i].Offset = offset
		} else {
			result[i].Offset = kafka.OffsetInvalid
		}
	}
	
	return result, nil
}