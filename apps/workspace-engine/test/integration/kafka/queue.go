package kafka

import (
	"sync"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// MessageQueue is a shared in-memory queue for testing
type MessageQueue struct {
	mu       sync.Mutex
	messages []*kafka.Message
	cond     *sync.Cond
}

// NewMessageQueue creates a new message queue
func NewMessageQueue() *MessageQueue {
	mq := &MessageQueue{
		messages: make([]*kafka.Message, 0),
	}
	mq.cond = sync.NewCond(&mq.mu)
	return mq
}

// Push adds a message to the queue
func (mq *MessageQueue) Push(msg *kafka.Message) {
	mq.mu.Lock()
	defer mq.mu.Unlock()
	mq.messages = append(mq.messages, msg)
	mq.cond.Signal()
}

// Pop removes and returns the first message from the queue
// Returns nil if timeout is reached
func (mq *MessageQueue) Pop(timeout time.Duration) (*kafka.Message, error) {
	mq.mu.Lock()
	defer mq.mu.Unlock()

	deadline := time.Now().Add(timeout)
	for len(mq.messages) == 0 {
		remaining := time.Until(deadline)
		if remaining <= 0 {
			// Timeout reached
			return nil, kafka.NewError(kafka.ErrTimedOut, "timed out waiting for message", false)
		}

		// Wait for signal or timeout
		done := make(chan struct{})
		go func() {
			time.Sleep(remaining)
			close(done)
		}()

		mq.cond.Wait()

		select {
		case <-done:
			// Timeout
			if len(mq.messages) == 0 {
				return nil, kafka.NewError(kafka.ErrTimedOut, "timed out waiting for message", false)
			}
		default:
			// Got signaled, continue loop to check messages
		}
	}

	// Get first message
	msg := mq.messages[0]
	mq.messages = mq.messages[1:]
	return msg, nil
}