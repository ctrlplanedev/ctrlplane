package memory

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"workspace-engine/pkg/messaging"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBroker(t *testing.T) {
	broker := NewBroker(3)

	// Test topic creation
	topic := broker.GetOrCreateTopic("test-topic")
	assert.NotNil(t, topic)
	assert.Equal(t, int32(3), topic.GetPartitionCount())

	// Test getting existing topic
	topic2 := broker.GetOrCreateTopic("test-topic")
	assert.Equal(t, topic, topic2)

	// Test publishing
	err := topic.Publish([]byte("key1"), []byte("value1"))
	require.NoError(t, err)
}

func TestProducerAndConsumer(t *testing.T) {
	broker := NewBroker(3)
	topicName := "test-topic"

	// Create producer
	producer := NewProducer(broker, topicName)
	defer producer.Close()

	// Create consumer
	consumer := NewConsumer(broker, "test-group")
	defer consumer.Close()

	// Subscribe to topic
	err := consumer.Subscribe(topicName)
	require.NoError(t, err)

	// Publish messages with same key to ensure ordering
	err = producer.Publish([]byte("workspace-1"), []byte(`{"event":"create"}`))
	require.NoError(t, err)

	err = producer.Publish([]byte("workspace-1"), []byte(`{"event":"update"}`))
	require.NoError(t, err)

	// Read first message
	msg1, err := consumer.ReadMessage(time.Second)
	require.NoError(t, err)
	require.NotNil(t, msg1)
	assert.Equal(t, `{"event":"create"}`, string(msg1.Value))

	// Commit first message
	err = consumer.CommitMessage(msg1)
	require.NoError(t, err)

	// Verify committed offset
	offset, err := consumer.GetCommittedOffset(msg1.Partition)
	require.NoError(t, err)
	assert.Equal(t, msg1.Offset, offset)

	// Read second message
	msg2, err := consumer.ReadMessage(time.Second)
	require.NoError(t, err)
	require.NotNil(t, msg2)
	assert.Equal(t, `{"event":"update"}`, string(msg2.Value))

	// Both messages should be on same partition (same key)
	assert.Equal(t, msg1.Partition, msg2.Partition)

	// Commit second message
	err = consumer.CommitMessage(msg2)
	require.NoError(t, err)

	// Try to read when no messages available (should timeout)
	msg3, err := consumer.ReadMessage(100 * time.Millisecond)
	assert.Error(t, err)
	assert.True(t, messaging.IsTimeout(err))
	assert.Nil(t, msg3)
}

func TestConsumerSeek(t *testing.T) {
	broker := NewBroker(1)
	topicName := "test-topic"

	producer := NewProducer(broker, topicName)
	defer producer.Close()

	consumer := NewConsumer(broker, "test-group")
	defer consumer.Close()

	err := consumer.Subscribe(topicName)
	require.NoError(t, err)

	// Publish 5 messages
	for range 5 {
		err = producer.Publish([]byte("key"), []byte("message"))
		require.NoError(t, err)
	}

	// Read first message (offset 0)
	msg1, err := consumer.ReadMessage(time.Second)
	require.NoError(t, err)
	assert.Equal(t, int64(0), msg1.Offset)

	// Read second message (offset 1)
	msg2, err := consumer.ReadMessage(time.Second)
	require.NoError(t, err)
	assert.Equal(t, int64(1), msg2.Offset)

	// Seek back to offset 0
	err = consumer.SeekToOffset(0, 0)
	require.NoError(t, err)

	// Read again - should get first message
	msg3, err := consumer.ReadMessage(time.Second)
	require.NoError(t, err)
	assert.Equal(t, int64(0), msg3.Offset)

	// Seek to offset 4
	err = consumer.SeekToOffset(0, 4)
	require.NoError(t, err)

	// Read - should get last message
	msg4, err := consumer.ReadMessage(time.Second)
	require.NoError(t, err)
	assert.Equal(t, int64(4), msg4.Offset)
}

func TestMultipleConsumers(t *testing.T) {
	broker := NewBroker(1)
	topicName := "test-topic"

	producer := NewProducer(broker, topicName)
	defer producer.Close()

	// Create two consumers with different group IDs
	consumer1 := NewConsumer(broker, "group-1")
	defer consumer1.Close()

	consumer2 := NewConsumer(broker, "group-2")
	defer consumer2.Close()

	err := consumer1.Subscribe(topicName)
	require.NoError(t, err)

	err = consumer2.Subscribe(topicName)
	require.NoError(t, err)

	// Publish a message
	err = producer.Publish([]byte("key"), []byte("message"))
	require.NoError(t, err)

	// Both consumers should be able to read the same message
	msg1, err := consumer1.ReadMessage(time.Second)
	require.NoError(t, err)
	require.NotNil(t, msg1)

	msg2, err := consumer2.ReadMessage(time.Second)
	require.NoError(t, err)
	require.NotNil(t, msg2)

	assert.Equal(t, msg1.Offset, msg2.Offset)
	assert.Equal(t, msg1.Value, msg2.Value)

	// Each consumer maintains its own committed offsets
	err = consumer1.CommitMessage(msg1)
	require.NoError(t, err)

	offset1, err := consumer1.GetCommittedOffset(0)
	require.NoError(t, err)
	assert.Equal(t, int64(0), offset1)

	offset2, err := consumer2.GetCommittedOffset(0)
	require.NoError(t, err)
	assert.Equal(t, int64(-1), offset2) // Not committed yet
}

func TestPartitioning(t *testing.T) {
	broker := NewBroker(3)
	topicName := "test-topic"

	producer := NewProducer(broker, topicName)
	defer producer.Close()

	consumer := NewConsumer(broker, "test-group")
	defer consumer.Close()

	err := consumer.Subscribe(topicName)
	require.NoError(t, err)

	// Verify partition count
	partCount, err := consumer.GetPartitionCount()
	require.NoError(t, err)
	assert.Equal(t, int32(3), partCount)

	// Verify assigned partitions
	parts, err := consumer.GetAssignedPartitions()
	require.NoError(t, err)
	assert.Len(t, parts, 3)
	assert.Equal(t, []int32{0, 1, 2}, parts)

	// Publish messages with same key - should go to same partition
	key := []byte("workspace-123")
	for range 5 {
		err = producer.Publish(key, []byte("message"))
		require.NoError(t, err)
	}

	// Read all messages and verify they're on the same partition
	partitions := make(map[int32]int)
	for range 5 {
		msg, err := consumer.ReadMessage(time.Second)
		require.NoError(t, err)
		require.NotNil(t, msg)
		partitions[msg.Partition]++
	}

	// All 5 messages should be on the same partition
	assert.Len(t, partitions, 1)
}

func TestProducerFlushAndClose(t *testing.T) {
	broker := NewBroker(1)
	producer := NewProducer(broker, "test-topic")

	// Publish a message
	err := producer.Publish([]byte("key"), []byte("value"))
	require.NoError(t, err)

	// Flush should return 0 (no pending messages in sync implementation)
	pending := producer.Flush(1000)
	assert.Equal(t, 0, pending)

	// Close should succeed
	err = producer.Close()
	require.NoError(t, err)

	// Publishing after close should fail
	err = producer.Publish([]byte("key"), []byte("value"))
	assert.Error(t, err)
}

func TestConsumerClosedOperations(t *testing.T) {
	broker := NewBroker(1)
	consumer := NewConsumer(broker, "test-group")

	err := consumer.Subscribe("test-topic")
	require.NoError(t, err)

	// Close the consumer
	err = consumer.Close()
	require.NoError(t, err)

	// Verify operations fail after close
	_, err = consumer.ReadMessage(time.Second)
	assert.Error(t, err)

	_, err = consumer.GetCommittedOffset(0)
	assert.Error(t, err)

	err = consumer.SeekToOffset(0, 0)
	assert.Error(t, err)
}

func TestMessageUnmarshal(t *testing.T) {
	broker := NewBroker(1)
	producer := NewProducer(broker, "test-topic")
	defer producer.Close()

	consumer := NewConsumer(broker, "test-group")
	defer consumer.Close()

	err := consumer.Subscribe("test-topic")
	require.NoError(t, err)

	// Publish JSON message
	err = producer.Publish(
		[]byte("workspace-1"),
		[]byte(`{"eventType":"test","data":{"value":123}}`),
	)
	require.NoError(t, err)

	// Read and unmarshal
	msg, err := consumer.ReadMessage(time.Second)
	require.NoError(t, err)
	require.NotNil(t, msg)

	var event map[string]any
	err = msg.Unmarshal(&event)
	require.NoError(t, err)

	assert.Equal(t, "test", event["eventType"])
	assert.Equal(t, "workspace-1", msg.KeyAsString())
}

// TestE2E_BasicWorkflow tests a complete producer-consumer workflow
func TestE2E_BasicWorkflow(t *testing.T) {
	broker := NewBroker(3)
	topicName := "workspace-events"

	// Create producer
	producer := NewProducer(broker, topicName)
	defer producer.Close()

	// Create consumer
	consumer := NewConsumer(broker, "engine-group")
	defer consumer.Close()

	// Subscribe
	err := consumer.Subscribe(topicName)
	require.NoError(t, err)

	// Produce 100 messages across different workspaces
	workspaceCount := 10
	messagesPerWorkspace := 10

	for i := range workspaceCount {
		workspaceID := fmt.Sprintf("workspace-%d", i)
		for j := range messagesPerWorkspace {
			payload := fmt.Sprintf(`{"workspace":"%s","sequence":%d}`, workspaceID, j)
			err = producer.Publish([]byte(workspaceID), []byte(payload))
			require.NoError(t, err)
		}
	}

	// Consume all messages and verify
	messagesByWorkspace := make(map[string]int)
	totalMessages := workspaceCount * messagesPerWorkspace

	for range totalMessages {
		msg, err := consumer.ReadMessage(time.Second)
		require.NoError(t, err)
		require.NotNil(t, msg)

		workspaceID := msg.KeyAsString()
		messagesByWorkspace[workspaceID]++

		// Commit every message
		err = consumer.CommitMessage(msg)
		require.NoError(t, err)
	}

	// Verify each workspace got all its messages
	for i := range workspaceCount {
		workspaceID := fmt.Sprintf("workspace-%d", i)
		assert.Equal(t, messagesPerWorkspace, messagesByWorkspace[workspaceID],
			"workspace %s should have %d messages", workspaceID, messagesPerWorkspace)
	}

	// Verify no more messages
	msg, err := consumer.ReadMessage(100 * time.Millisecond)
	assert.Error(t, err)
	assert.True(t, messaging.IsTimeout(err), "should timeout when no more messages")
	assert.Nil(t, msg, "should not have any more messages")
}

// TestE2E_MessageOrdering tests that messages with the same key maintain order
func TestE2E_MessageOrdering(t *testing.T) {
	broker := NewBroker(3)
	topicName := "ordered-events"

	producer := NewProducer(broker, topicName)
	defer producer.Close()

	consumer := NewConsumer(broker, "test-group")
	defer consumer.Close()

	err := consumer.Subscribe(topicName)
	require.NoError(t, err)

	// Publish ordered sequence for a workspace
	workspaceID := "workspace-123"
	sequenceCount := 50

	for i := range sequenceCount {
		payload := fmt.Sprintf(`{"sequence":%d}`, i)
		err = producer.Publish([]byte(workspaceID), []byte(payload))
		require.NoError(t, err)
	}

	// Consume and verify ordering
	lastSequence := -1
	for range sequenceCount {
		msg, err := consumer.ReadMessage(time.Second)
		require.NoError(t, err)
		require.NotNil(t, msg)

		var event map[string]any
		err = msg.Unmarshal(&event)
		require.NoError(t, err)

		sequence := int(event["sequence"].(float64))
		assert.Greater(t, sequence, lastSequence, "messages should be in order")
		lastSequence = sequence

		err = consumer.CommitMessage(msg)
		require.NoError(t, err)
	}

	assert.Equal(t, sequenceCount-1, lastSequence, "should have received all messages in order")
}

// TestE2E_ConsumerRestart tests offset persistence across consumer restarts
func TestE2E_ConsumerRestart(t *testing.T) {
	broker := NewBroker(1)
	topicName := "persistent-topic"
	groupID := "persistent-group"

	producer := NewProducer(broker, topicName)
	defer producer.Close()

	// Publish 10 messages
	for i := range 10 {
		payload := fmt.Sprintf(`{"message":%d}`, i)
		err := producer.Publish([]byte("key"), []byte(payload))
		require.NoError(t, err)
	}

	// First consumer: read and commit first 5 messages
	consumer1 := NewConsumer(broker, groupID)
	err := consumer1.Subscribe(topicName)
	require.NoError(t, err)

	for range 5 {
		msg, err := consumer1.ReadMessage(time.Second)
		require.NoError(t, err)
		require.NotNil(t, msg)
		err = consumer1.CommitMessage(msg)
		require.NoError(t, err)
	}

	lastCommitted, err := consumer1.GetCommittedOffset(0)
	require.NoError(t, err)
	assert.Equal(t, int64(4), lastCommitted)

	consumer1.Close()

	// Second consumer: should resume from offset 5
	consumer2 := NewConsumer(broker, groupID)
	err = consumer2.Subscribe(topicName)
	require.NoError(t, err)

	// Seek to last committed offset + 1
	err = consumer2.SeekToOffset(0, lastCommitted+1)
	require.NoError(t, err)

	// Read remaining 5 messages
	for i := range 5 {
		msg, err := consumer2.ReadMessage(time.Second)
		require.NoError(t, err)
		require.NotNil(t, msg)

		var event map[string]any
		err = msg.Unmarshal(&event)
		require.NoError(t, err)

		expectedSequence := 5 + i
		actualSequence := int(event["message"].(float64))
		assert.Equal(t, expectedSequence, actualSequence,
			"should resume from message %d", expectedSequence)

		err = consumer2.CommitMessage(msg)
		require.NoError(t, err)
	}

	consumer2.Close()
}

// TestE2E_MultipleConsumerGroups tests independent consumer groups
func TestE2E_MultipleConsumerGroups(t *testing.T) {
	broker := NewBroker(2)
	topicName := "shared-topic"

	producer := NewProducer(broker, topicName)
	defer producer.Close()

	// Create three consumer groups
	consumer1 := NewConsumer(broker, "group-1")
	defer consumer1.Close()

	consumer2 := NewConsumer(broker, "group-2")
	defer consumer2.Close()

	consumer3 := NewConsumer(broker, "group-3")
	defer consumer3.Close()

	// All subscribe to same topic
	require.NoError(t, consumer1.Subscribe(topicName))
	require.NoError(t, consumer2.Subscribe(topicName))
	require.NoError(t, consumer3.Subscribe(topicName))

	// Publish 20 messages
	messageCount := 20
	for i := range messageCount {
		payload := fmt.Sprintf(`{"id":%d}`, i)
		err := producer.Publish([]byte("key"), []byte(payload))
		require.NoError(t, err)
	}

	// Each consumer group should be able to read all messages independently
	for groupIdx, consumer := range []*Consumer{consumer1, consumer2, consumer3} {
		messagesRead := 0
		for range messageCount {
			msg, err := consumer.ReadMessage(time.Second)
			require.NoError(t, err, "group %d should read message", groupIdx+1)
			require.NotNil(t, msg)
			messagesRead++
			err = consumer.CommitMessage(msg)
			require.NoError(t, err)
		}
		assert.Equal(t, messageCount, messagesRead, "group %d should read all messages", groupIdx+1)
	}

	// Verify each group has committed offsets independently
	// Note: In the in-memory implementation with 2 partitions, messages are split
	// so we check that at least one partition has commits
	hasCommits1 := false
	hasCommits2 := false
	hasCommits3 := false

	for i := int32(0); i < 2; i++ {
		if offset, _ := consumer1.GetCommittedOffset(i); offset >= 0 {
			hasCommits1 = true
		}
		if offset, _ := consumer2.GetCommittedOffset(i); offset >= 0 {
			hasCommits2 = true
		}
		if offset, _ := consumer3.GetCommittedOffset(i); offset >= 0 {
			hasCommits3 = true
		}
	}

	assert.True(t, hasCommits1, "consumer1 should have committed offsets")
	assert.True(t, hasCommits2, "consumer2 should have committed offsets")
	assert.True(t, hasCommits3, "consumer3 should have committed offsets")
}

// TestE2E_ConcurrentProducers tests multiple producers writing simultaneously
func TestE2E_ConcurrentProducers(t *testing.T) {
	broker := NewBroker(5)
	topicName := "concurrent-topic"

	producerCount := 10
	messagesPerProducer := 100

	var wg sync.WaitGroup
	wg.Add(producerCount)

	// Launch concurrent producers
	for i := range producerCount {
		go func(producerID int) {
			defer wg.Done()

			producer := NewProducer(broker, topicName)
			defer producer.Close()

			for j := range messagesPerProducer {
				key := fmt.Sprintf("producer-%d", producerID)
				payload := fmt.Sprintf(`{"producer":%d,"msg":%d}`, producerID, j)
				err := producer.Publish([]byte(key), []byte(payload))
				require.NoError(t, err)
			}
		}(i)
	}

	wg.Wait()

	// Verify all messages were stored
	consumer := NewConsumer(broker, "verify-group")
	defer consumer.Close()

	err := consumer.Subscribe(topicName)
	require.NoError(t, err)

	totalExpected := producerCount * messagesPerProducer
	messagesRead := 0

	for range totalExpected {
		msg, err := consumer.ReadMessage(time.Second)
		require.NoError(t, err)
		require.NotNil(t, msg)
		messagesRead++
	}

	assert.Equal(t, totalExpected, messagesRead, "should have all messages from concurrent producers")
}

// TestE2E_ConcurrentConsumers tests Kafka-style partition distribution among consumers in same group
func TestE2E_ConcurrentConsumers(t *testing.T) {
	broker := NewBroker(3) // 3 partitions
	topicName := "consumer-test"

	producer := NewProducer(broker, topicName)
	defer producer.Close()

	// Publish messages
	messageCount := 100
	for i := range messageCount {
		payload := fmt.Sprintf(`{"id":%d}`, i)
		err := producer.Publish([]byte("key"), []byte(payload))
		require.NoError(t, err)
	}

	// Create multiple consumers in SAME group - they should split the work
	consumerCount := 3
	groupID := "shared-group"

	var wg sync.WaitGroup
	wg.Add(consumerCount)

	type consumerResult struct {
		consumerIdx  int
		messagesRead int
		messageIDs   []int
	}
	resultsChan := make(chan consumerResult, consumerCount)

	for i := range consumerCount {
		go func(consumerIdx int) {
			defer wg.Done()

			consumer := NewConsumer(broker, groupID)
			defer consumer.Close()

			err := consumer.Subscribe(topicName)
			require.NoError(t, err)

			messagesRead := 0
			messageIDs := make([]int, 0)

			// Read until timeout (no more messages for this consumer)
			for {
				msg, err := consumer.ReadMessage(200 * time.Millisecond)
				if err != nil {
					if messaging.IsTimeout(err) {
						break // Timeout - no more messages for us
					}
					t.Errorf("unexpected error: %v", err)
					break
				}

				var event map[string]any
				_ = msg.Unmarshal(&event)
				msgID := int(event["id"].(float64))
				messageIDs = append(messageIDs, msgID)
				messagesRead++
				_ = consumer.CommitMessage(msg)
			}

			resultsChan <- consumerResult{
				consumerIdx:  consumerIdx,
				messagesRead: messagesRead,
				messageIDs:   messageIDs,
			}
		}(i)
	}

	wg.Wait()
	close(resultsChan)

	// Collect results
	totalMessagesRead := 0
	allMessageIDs := make(map[int]bool)

	consumersWithMessages := 0
	for result := range resultsChan {
		t.Logf("Consumer %d read %d messages", result.consumerIdx, result.messagesRead)
		totalMessagesRead += result.messagesRead

		if result.messagesRead > 0 {
			consumersWithMessages++
		}

		// Track all unique message IDs
		for _, msgID := range result.messageIDs {
			// Each message should only be read once across all consumers
			assert.False(t, allMessageIDs[msgID], "Message %d was read by multiple consumers", msgID)
			allMessageIDs[msgID] = true
		}
	}

	// At least one consumer should have read messages
	assert.Greater(t, consumersWithMessages, 0, "At least one consumer should have read messages")

	// All messages should be consumed exactly once across the group
	assert.Equal(t, messageCount, totalMessagesRead, "Total messages read should equal published")
	assert.Equal(t, messageCount, len(allMessageIDs), "All unique messages should be consumed")
}

// TestE2E_DifferentConsumerGroups tests that different groups read independently
func TestE2E_DifferentConsumerGroups(t *testing.T) {
	broker := NewBroker(1)
	topicName := "multi-group-test"

	producer := NewProducer(broker, topicName)
	defer producer.Close()

	// Publish messages
	messageCount := 50
	for i := range messageCount {
		payload := fmt.Sprintf(`{"id":%d}`, i)
		err := producer.Publish([]byte("key"), []byte(payload))
		require.NoError(t, err)
	}

	// Create consumers in different groups
	consumerCount := 3
	var wg sync.WaitGroup
	wg.Add(consumerCount)

	type consumerResult struct {
		groupID      string
		messagesRead int
	}
	resultsChan := make(chan consumerResult, consumerCount)

	for i := range consumerCount {
		go func(consumerIdx int) {
			defer wg.Done()

			groupID := fmt.Sprintf("group-%d", consumerIdx)
			consumer := NewConsumer(broker, groupID)
			defer consumer.Close()

			err := consumer.Subscribe(topicName)
			require.NoError(t, err)

			messagesRead := 0
			for range messageCount {
				msg, err := consumer.ReadMessage(time.Second)
				if err != nil {
					if messaging.IsTimeout(err) {
						break
					}
					t.Errorf("unexpected error: %v", err)
					break
				}
				messagesRead++
				_ = consumer.CommitMessage(msg)
			}

			resultsChan <- consumerResult{
				groupID:      groupID,
				messagesRead: messagesRead,
			}
		}(i)
	}

	wg.Wait()
	close(resultsChan)

	// Each consumer group should read ALL messages independently
	for result := range resultsChan {
		assert.Equal(t, messageCount, result.messagesRead,
			"%s should read all %d messages", result.groupID, messageCount)
	}
}

// TestE2E_PartitionDistribution tests that messages are distributed across partitions
func TestE2E_PartitionDistribution(t *testing.T) {
	broker := NewBroker(5)
	topicName := "partitioned-topic"

	producer := NewProducer(broker, topicName)
	defer producer.Close()

	consumer := NewConsumer(broker, "test-group")
	defer consumer.Close()

	err := consumer.Subscribe(topicName)
	require.NoError(t, err)

	// Publish messages with different keys
	messageCount := 100
	for i := range messageCount {
		key := fmt.Sprintf("key-%d", i)
		payload := fmt.Sprintf(`{"id":%d}`, i)
		err := producer.Publish([]byte(key), []byte(payload))
		require.NoError(t, err)
	}

	// Track which partitions received messages
	partitionCounts := make(map[int32]int)

	for range messageCount {
		msg, err := consumer.ReadMessage(time.Second)
		require.NoError(t, err)
		require.NotNil(t, msg)
		partitionCounts[msg.Partition]++
	}

	// Verify messages are distributed across multiple partitions
	assert.Greater(t, len(partitionCounts), 1, "messages should be distributed across multiple partitions")

	// With 100 different keys and 5 partitions, most partitions should have some messages
	for partition, count := range partitionCounts {
		t.Logf("Partition %d: %d messages", partition, count)
	}
}

// TestE2E_SeekAndReplay tests seeking back and replaying messages
func TestE2E_SeekAndReplay(t *testing.T) {
	broker := NewBroker(1)
	topicName := "replay-topic"

	producer := NewProducer(broker, topicName)
	defer producer.Close()

	consumer := NewConsumer(broker, "replay-group")
	defer consumer.Close()

	err := consumer.Subscribe(topicName)
	require.NoError(t, err)

	// Publish 10 messages
	for i := range 10 {
		payload := fmt.Sprintf(`{"seq":%d}`, i)
		err := producer.Publish([]byte("key"), []byte(payload))
		require.NoError(t, err)
	}

	// Read all messages
	firstRun := make([]int, 0)
	for range 10 {
		msg, err := consumer.ReadMessage(time.Second)
		require.NoError(t, err)

		var event map[string]any
		_ = msg.Unmarshal(&event)
		firstRun = append(firstRun, int(event["seq"].(float64)))

		_ = consumer.CommitMessage(msg)
	}

	// Seek back to beginning
	err = consumer.SeekToOffset(0, 0)
	require.NoError(t, err)

	// Read again and verify same messages
	secondRun := make([]int, 0)
	for range 10 {
		msg, err := consumer.ReadMessage(time.Second)
		require.NoError(t, err)

		var event map[string]any
		_ = msg.Unmarshal(&event)
		secondRun = append(secondRun, int(event["seq"].(float64)))
	}

	assert.Equal(t, firstRun, secondRun, "replayed messages should match original")

	// Seek to middle (offset 5)
	err = consumer.SeekToOffset(0, 5)
	require.NoError(t, err)

	// Read from middle
	msg, err := consumer.ReadMessage(time.Second)
	require.NoError(t, err)

	var event map[string]any
	_ = msg.Unmarshal(&event)
	assert.Equal(t, 5, int(event["seq"].(float64)), "should read from offset 5")
}

// TestE2E_LargeMessages tests handling of large message payloads
func TestE2E_LargeMessages(t *testing.T) {
	broker := NewBroker(2)
	topicName := "large-messages"

	producer := NewProducer(broker, topicName)
	defer producer.Close()

	consumer := NewConsumer(broker, "test-group")
	defer consumer.Close()

	err := consumer.Subscribe(topicName)
	require.NoError(t, err)

	// Create large payload (1MB)
	largeData := make([]byte, 1024*1024)
	for i := range largeData {
		largeData[i] = byte(i % 256)
	}

	// Publish large message
	err = producer.Publish([]byte("large-key"), largeData)
	require.NoError(t, err)

	// Read large message
	msg, err := consumer.ReadMessage(time.Second)
	require.NoError(t, err)
	require.NotNil(t, msg)

	assert.Equal(t, len(largeData), len(msg.Value), "large message should be fully preserved")
	assert.Equal(t, largeData, msg.Value, "large message content should match")
}

// TestE2E_EmptyMessages tests handling of empty message payloads
func TestE2E_EmptyMessages(t *testing.T) {
	broker := NewBroker(1)
	topicName := "empty-messages"

	producer := NewProducer(broker, topicName)
	defer producer.Close()

	consumer := NewConsumer(broker, "test-group")
	defer consumer.Close()

	err := consumer.Subscribe(topicName)
	require.NoError(t, err)

	// Publish message with empty value
	err = producer.Publish([]byte("key"), []byte{})
	require.NoError(t, err)

	// Publish message with empty key
	err = producer.Publish([]byte{}, []byte("value"))
	require.NoError(t, err)

	// Read both messages
	msg1, err := consumer.ReadMessage(time.Second)
	require.NoError(t, err)
	require.NotNil(t, msg1)
	assert.Equal(t, "key", msg1.KeyAsString())
	assert.Empty(t, msg1.Value)

	msg2, err := consumer.ReadMessage(time.Second)
	require.NoError(t, err)
	require.NotNil(t, msg2)
	assert.Empty(t, msg2.Key)
	assert.Equal(t, "value", string(msg2.Value))
}

// TestE2E_HighThroughput tests system under high message throughput
func TestE2E_HighThroughput(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping high throughput test in short mode")
	}

	broker := NewBroker(10)
	topicName := "high-throughput"

	producer := NewProducer(broker, topicName)
	defer producer.Close()

	// Publish 10,000 messages
	messageCount := 10000
	start := time.Now()

	for i := range messageCount {
		key := fmt.Sprintf("workspace-%d", i%100) // 100 different workspaces
		payload := fmt.Sprintf(`{"id":%d,"timestamp":%d}`, i, time.Now().UnixNano())
		err := producer.Publish([]byte(key), []byte(payload))
		require.NoError(t, err)
	}

	produceTime := time.Since(start)
	t.Logf("Produced %d messages in %v (%.2f msg/sec)",
		messageCount, produceTime, float64(messageCount)/produceTime.Seconds())

	// Consume all messages
	consumer := NewConsumer(broker, "throughput-group")
	defer consumer.Close()

	err := consumer.Subscribe(topicName)
	require.NoError(t, err)

	start = time.Now()
	messagesRead := 0

	for range messageCount {
		msg, err := consumer.ReadMessage(time.Second)
		require.NoError(t, err)
		require.NotNil(t, msg)
		messagesRead++

		// Commit every 100 messages
		if messagesRead%100 == 0 {
			_ = consumer.CommitMessage(msg)
		}
	}

	consumeTime := time.Since(start)
	t.Logf("Consumed %d messages in %v (%.2f msg/sec)",
		messagesRead, consumeTime, float64(messagesRead)/consumeTime.Seconds())

	assert.Equal(t, messageCount, messagesRead)
}
