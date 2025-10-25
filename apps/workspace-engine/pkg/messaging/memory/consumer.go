package memory

import (
	"fmt"
	"sync"
	"time"

	"workspace-engine/pkg/messaging"

	"github.com/charmbracelet/log"
)

// Consumer is an in-memory implementation of messaging.Consumer
type Consumer struct {
	mu              sync.RWMutex
	broker          *Broker
	groupID         string
	topic           *Topic
	topicName       string
	consumerGroup   *ConsumerGroup
	assignedParts   []int32
	closed          bool
	currentPartIdx  int // For round-robin reading across partitions
}

// Ensure Consumer implements messaging.Consumer
var _ messaging.Consumer = (*Consumer)(nil)

// NewConsumer creates a new in-memory consumer for a consumer group
func NewConsumer(broker *Broker, groupID string) *Consumer {
	consumerGroup := broker.GetOrCreateConsumerGroup(groupID)
	log.Info("Memory consumer created", "groupID", groupID)
	return &Consumer{
		broker:         broker,
		groupID:        groupID,
		consumerGroup:  consumerGroup,
		assignedParts:  []int32{},
		currentPartIdx: 0,
	}
}

// Subscribe subscribes to a topic
func (c *Consumer) Subscribe(topicName string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return fmt.Errorf("consumer is closed")
	}

	topic := c.broker.GetOrCreateTopic(topicName)
	c.topic = topic
	c.topicName = topicName

	// Get all partitions and assign them to this consumer
	// In a real Kafka implementation, partitions would be distributed among consumers in the same group
	// For this in-memory implementation, each consumer gets all partitions
	// but they coordinate through the consumer group's read positions to avoid duplicate reads
	c.assignedParts = topic.GetAllPartitionIDs()

	log.Info("Consumer subscribed", "topic", topicName, "partitions", len(c.assignedParts))
	return nil
}

// ReadMessage reads the next message with a timeout
// Returns nil message and nil error on timeout
func (c *Consumer) ReadMessage(timeout time.Duration) (*messaging.Message, error) {
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return nil, fmt.Errorf("consumer is closed")
	}
	
	if c.topic == nil {
		c.mu.Unlock()
		return nil, fmt.Errorf("consumer not subscribed to any topic")
	}
	c.mu.Unlock()

	startTime := time.Now()
	
	for {
		// Check timeout
		if time.Since(startTime) >= timeout {
			return nil, nil // Timeout - no message available
		}

		c.mu.Lock()
		
		// Try to read from each partition in round-robin fashion
		partitionsChecked := 0
		for partitionsChecked < len(c.assignedParts) {
			if len(c.assignedParts) == 0 {
				c.mu.Unlock()
				return nil, nil
			}

			// Get current partition
			partIdx := c.currentPartIdx % len(c.assignedParts)
			partID := c.assignedParts[partIdx]
			
			// Move to next partition for next read
			c.currentPartIdx = (c.currentPartIdx + 1) % len(c.assignedParts)
			partitionsChecked++

			// Get and atomically increment the group's read position for this partition
			// This ensures consumers in the same group don't read the same message
			offset := c.consumerGroup.GetNextReadOffset(c.topicName, partID)

			// Try to get the partition
			partition, err := c.topic.GetPartition(partID)
			if err != nil {
				c.mu.Unlock()
				return nil, err
			}

			// Check if there's a message at this offset
			partition.mu.RLock()
			var storedMsg *StoredMessage
			for _, msg := range partition.messages {
				if msg.Offset == offset {
					storedMsg = msg
					break
				}
			}
			partition.mu.RUnlock()

			if storedMsg != nil {
				// Found a message!
				msg := &messaging.Message{
					Key:       storedMsg.Key,
					Value:     storedMsg.Value,
					Partition: partID,
					Offset:    storedMsg.Offset,
					Timestamp: storedMsg.Timestamp,
				}

				c.mu.Unlock()
				log.Debug("Message read", "partition", partID, "offset", offset)
				return msg, nil
			}
			// If no message at this offset, we already incremented the group position
			// but that's ok - we just skip this offset
		}
		
		c.mu.Unlock()

		// No messages available in any partition, sleep briefly before retrying
		time.Sleep(10 * time.Millisecond)
	}
}

// CommitMessage commits the offset for a message
func (c *Consumer) CommitMessage(msg *messaging.Message) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.closed {
		return fmt.Errorf("consumer is closed")
	}

	if c.topic == nil {
		return fmt.Errorf("consumer not subscribed to any topic")
	}

	// Commit the offset for this partition in the consumer group
	c.consumerGroup.CommitOffset(c.topicName, msg.Partition, msg.Offset)
	
	log.Debug("Offset committed", "partition", msg.Partition, "offset", msg.Offset)
	return nil
}

// GetCommittedOffset gets the last committed offset for a partition
func (c *Consumer) GetCommittedOffset(partition int32) (int64, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.closed {
		return 0, fmt.Errorf("consumer is closed")
	}

	if c.topic == nil {
		return 0, fmt.Errorf("consumer not subscribed to any topic")
	}

	offset := c.consumerGroup.GetCommittedOffset(c.topicName, partition)
	return offset, nil
}

// SeekToOffset seeks to a specific offset for a partition
func (c *Consumer) SeekToOffset(partition int32, offset int64) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return fmt.Errorf("consumer is closed")
	}

	if c.topic == nil {
		return fmt.Errorf("consumer not subscribed to any topic")
	}

	// Verify partition exists
	_, err := c.topic.GetPartition(partition)
	if err != nil {
		return err
	}

	// Set read position for this partition in the consumer group
	c.consumerGroup.SetReadPosition(c.topicName, partition, offset)
	
	log.Debug("Seeked to offset", "partition", partition, "offset", offset)
	return nil
}

// GetAssignedPartitions returns the partitions assigned to this consumer
func (c *Consumer) GetAssignedPartitions() ([]int32, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.closed {
		return nil, fmt.Errorf("consumer is closed")
	}

	if c.topic == nil {
		return nil, fmt.Errorf("consumer not subscribed to any topic")
	}

	return c.assignedParts, nil
}

// GetPartitionCount returns the total number of partitions for the subscribed topic
func (c *Consumer) GetPartitionCount() (int32, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.closed {
		return 0, fmt.Errorf("consumer is closed")
	}

	if c.topic == nil {
		return 0, fmt.Errorf("consumer not subscribed to any topic")
	}

	return c.topic.GetPartitionCount(), nil
}

// Close closes the consumer
func (c *Consumer) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil
	}

	c.closed = true
	log.Info("Memory consumer closed", "groupID", c.groupID)
	return nil
}

