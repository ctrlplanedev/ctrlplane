package memory

import (
	"fmt"
	"sync"
	"time"

	"workspace-engine/pkg/messaging"
)

// Broker is an in-memory message broker that manages topics, partitions, and messages
type Broker struct {
	mu             sync.RWMutex
	topics         map[string]*Topic
	partitions     int32
	consumerGroups map[string]*ConsumerGroup
}

// ConsumerGroup tracks committed offsets and read positions for a consumer group
type ConsumerGroup struct {
	mu               sync.RWMutex
	groupID          string
	committedOffsets map[string]map[int32]int64 // topic -> partition -> last committed offset
	readPositions    map[string]map[int32]int64 // topic -> partition -> next offset to read
}

// Topic represents a message topic with multiple partitions
type Topic struct {
	mu         sync.RWMutex
	name       string
	partitions []*Partition
}

// Partition represents a single partition with ordered messages
type Partition struct {
	mu       sync.RWMutex
	id       int32
	messages []*StoredMessage
	offset   int64 // Next offset to assign
}

// StoredMessage represents a message stored in a partition
type StoredMessage struct {
	Offset    int64
	Key       []byte
	Value     []byte
	Timestamp time.Time
}

// NewBroker creates a new in-memory broker
func NewBroker(defaultPartitions int32) *Broker {
	return &Broker{
		topics:         make(map[string]*Topic),
		partitions:     defaultPartitions,
		consumerGroups: make(map[string]*ConsumerGroup),
	}
}

// GetOrCreateTopic gets or creates a topic with the default number of partitions
func (b *Broker) GetOrCreateTopic(name string) *Topic {
	b.mu.Lock()
	defer b.mu.Unlock()

	if topic, exists := b.topics[name]; exists {
		return topic
	}

	topic := &Topic{
		name:       name,
		partitions: make([]*Partition, b.partitions),
	}

	for i := int32(0); i < b.partitions; i++ {
		topic.partitions[i] = &Partition{
			id:       i,
			messages: make([]*StoredMessage, 0),
			offset:   0,
		}
	}

	b.topics[name] = topic
	return topic
}

// GetTopic gets a topic by name
func (b *Broker) GetTopic(name string) (*Topic, error) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	topic, exists := b.topics[name]
	if !exists {
		return nil, fmt.Errorf("topic %s does not exist", name)
	}

	return topic, nil
}

// Publish publishes a message to a topic
// The partition is determined by hashing the key
func (t *Topic) Publish(key, value []byte) error {
	partition := t.getPartitionForKey(key)
	
	partition.mu.Lock()
	defer partition.mu.Unlock()

	msg := &StoredMessage{
		Offset:    partition.offset,
		Key:       key,
		Value:     value,
		Timestamp: time.Now(),
	}

	partition.messages = append(partition.messages, msg)
	partition.offset++

	return nil
}

// getPartitionForKey determines which partition a key should go to
func (t *Topic) getPartitionForKey(key []byte) *Partition {
	if len(key) == 0 {
		return t.partitions[0]
	}

	// Simple hash function
	hash := uint32(0)
	for _, b := range key {
		hash = hash*31 + uint32(b)
	}

	partitionIdx := hash % uint32(len(t.partitions))
	return t.partitions[partitionIdx]
}

// GetPartition gets a specific partition by ID
func (t *Topic) GetPartition(id int32) (*Partition, error) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	if id < 0 || id >= int32(len(t.partitions)) {
		return nil, fmt.Errorf("partition %d out of range", id)
	}

	return t.partitions[id], nil
}

// GetPartitionCount returns the number of partitions in the topic
func (t *Topic) GetPartitionCount() int32 {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return int32(len(t.partitions))
}

// GetAllPartitionIDs returns all partition IDs
func (t *Topic) GetAllPartitionIDs() []int32 {
	t.mu.RLock()
	defer t.mu.RUnlock()

	ids := make([]int32, len(t.partitions))
	for i := range t.partitions {
		ids[i] = int32(i)
	}
	return ids
}

// ReadMessage reads a message from a partition at the given offset
func (p *Partition) ReadMessage(offset int64) (*messaging.Message, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	// Find message at offset
	for _, msg := range p.messages {
		if msg.Offset == offset {
			return &messaging.Message{
				Key:       msg.Key,
				Value:     msg.Value,
				Partition: p.id,
				Offset:    msg.Offset,
				Timestamp: msg.Timestamp,
			}, nil
		}
	}

	return nil, fmt.Errorf("no message at offset %d", offset)
}

// GetMessageCount returns the number of messages in the partition
func (p *Partition) GetMessageCount() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.messages)
}

// GetHighWaterMark returns the offset of the next message to be written
func (p *Partition) GetHighWaterMark() int64 {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.offset
}

// GetMessagesFrom returns all messages starting from the given offset
func (p *Partition) GetMessagesFrom(offset int64) []*StoredMessage {
	p.mu.RLock()
	defer p.mu.RUnlock()

	result := make([]*StoredMessage, 0)
	for _, msg := range p.messages {
		if msg.Offset >= offset {
			result = append(result, msg)
		}
	}
	return result
}

// GetOrCreateConsumerGroup gets or creates a consumer group
func (b *Broker) GetOrCreateConsumerGroup(groupID string) *ConsumerGroup {
	b.mu.Lock()
	defer b.mu.Unlock()

	if group, exists := b.consumerGroups[groupID]; exists {
		return group
	}

	group := &ConsumerGroup{
		groupID:          groupID,
		committedOffsets: make(map[string]map[int32]int64),
		readPositions:    make(map[string]map[int32]int64),
	}
	b.consumerGroups[groupID] = group
	return group
}

// GetCommittedOffset gets the last committed offset for a topic partition in a consumer group
func (cg *ConsumerGroup) GetCommittedOffset(topic string, partition int32) int64 {
	cg.mu.RLock()
	defer cg.mu.RUnlock()

	if partitionOffsets, exists := cg.committedOffsets[topic]; exists {
		if offset, exists := partitionOffsets[partition]; exists {
			return offset
		}
	}
	return -1 // No committed offset
}

// CommitOffset commits an offset for a topic partition in a consumer group
func (cg *ConsumerGroup) CommitOffset(topic string, partition int32, offset int64) {
	cg.mu.Lock()
	defer cg.mu.Unlock()

	if _, exists := cg.committedOffsets[topic]; !exists {
		cg.committedOffsets[topic] = make(map[int32]int64)
	}
	cg.committedOffsets[topic][partition] = offset
}

// GetNextReadOffset gets and increments the next read offset for a topic partition
// This is used to coordinate reads among consumers in the same group
func (cg *ConsumerGroup) GetNextReadOffset(topic string, partition int32) int64 {
	cg.mu.Lock()
	defer cg.mu.Unlock()

	if _, exists := cg.readPositions[topic]; !exists {
		cg.readPositions[topic] = make(map[int32]int64)
	}

	offset := cg.readPositions[topic][partition]
	cg.readPositions[topic][partition] = offset + 1
	return offset
}

// SetReadPosition sets the read position for a topic partition
// This is used when seeking
func (cg *ConsumerGroup) SetReadPosition(topic string, partition int32, offset int64) {
	cg.mu.Lock()
	defer cg.mu.Unlock()

	if _, exists := cg.readPositions[topic]; !exists {
		cg.readPositions[topic] = make(map[int32]int64)
	}
	cg.readPositions[topic][partition] = offset
}

// GetReadPosition gets the current read position for a topic partition
func (cg *ConsumerGroup) GetReadPosition(topic string, partition int32) int64 {
	cg.mu.RLock()
	defer cg.mu.RUnlock()

	if partitionPositions, exists := cg.readPositions[topic]; exists {
		if offset, exists := partitionPositions[partition]; exists {
			return offset
		}
	}
	return 0
}

