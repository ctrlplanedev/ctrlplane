package partitioner

// PartitionForWorkspace computes which partition a workspace ID should be routed to
// using Murmur2 hash (matching Kafka's default partitioner and kafkajs)
// This is copied from workspace-engine/pkg/workspace/kafka/state.go
func PartitionForWorkspace(workspaceID string, numPartitions int32) int32 {
	h := murmur2([]byte(workspaceID))
	positive := int32(h & 0x7fffffff) // mask sign bit like Kafka
	return positive % numPartitions
}

// murmur2 implements the Murmur2 hash algorithm used by Kafka's default partitioner
func murmur2(data []byte) uint32 {
	const (
		seed uint32 = 0x9747b28c
		m    uint32 = 0x5bd1e995
		r           = 24
	)

	h := seed ^ uint32(len(data))
	length := len(data)

	for length >= 4 {
		k := uint32(data[0]) | uint32(data[1])<<8 | uint32(data[2])<<16 | uint32(data[3])<<24

		k *= m
		k ^= k >> r
		k *= m

		h *= m
		h ^= k

		data = data[4:]
		length -= 4
	}

	switch length {
	case 3:
		h ^= uint32(data[2]) << 16
		fallthrough
	case 2:
		h ^= uint32(data[1]) << 8
		fallthrough
	case 1:
		h ^= uint32(data[0])
		h *= m
	}

	h ^= h >> 13
	h *= m
	h ^= h >> 15

	return h
}
