package messaging

// Producer defines the interface for producing messages
// This interface is library-agnostic and can be implemented by Kafka, in-memory, or other message systems
type Producer interface {
	// Publish publishes a message to the topic
	// key is used for partitioning (e.g., workspace ID)
	// value is the message payload
	// partition is optional; if set to nil, the partition will be determined by key or other means
	Publish(key []byte, value []byte) error

	PublishToPartition(key []byte, value []byte, partition int32) error

	// Flush waits for all pending messages to be delivered
	// Returns the number of messages still pending after timeout
	Flush(timeoutMs int) int

	// Close closes the producer and releases resources
	Close() error
}
