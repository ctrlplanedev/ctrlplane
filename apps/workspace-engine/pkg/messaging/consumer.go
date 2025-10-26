package messaging

import (
	"encoding/json"
	"errors"
	"time"
)

// ErrTimeout is returned when ReadMessage times out waiting for a message
var ErrTimeout = errors.New("timeout waiting for message")

// IsTimeout checks if an error is a timeout error
func IsTimeout(err error) bool {
	return errors.Is(err, ErrTimeout)
}

// Message represents a consumed message, abstracted from any specific messaging library
type Message struct {
	// Key is the message partition key (typically workspace ID)
	Key []byte
	// Value is the message payload
	Value []byte
	// Partition is the partition number this message came from
	Partition int32
	// Offset is the message offset within the partition
	Offset int64
	// Timestamp is when the message was produced
	Timestamp time.Time
}

func (m *Message) Unmarshal(v any) error {
	return json.Unmarshal(m.Value, v)
}

func (m *Message) KeyAsString() string {
	return string(m.Key)
}

// Consumer defines the interface for consuming messages
// This interface is library-agnostic and can be implemented by Kafka, in-memory, or other message systems
type Consumer interface {
	// ReadMessage reads the next message with a timeout
	// Returns ErrTimeout if no message is available within the timeout duration
	ReadMessage(timeout time.Duration) (*Message, error)

	// CommitMessage commits the offset for a message
	CommitMessage(msg *Message) error

	// GetCommittedOffset gets the last committed offset for a partition
	GetCommittedOffset(partition int32) (int64, error)

	// SeekToOffset seeks to a specific offset for a partition
	SeekToOffset(partition int32, offset int64) error

	// GetAssignedPartitions returns the partitions assigned to this consumer
	GetAssignedPartitions() ([]int32, error)

	// GetPartitionCount returns the total number of partitions for the subscribed topic
	GetPartitionCount() (int32, error)

	// Close closes the consumer
	Close() error
}
