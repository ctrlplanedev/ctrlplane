package kafka

import (
	"context"
	"encoding/binary"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/workspace"

	"golang.org/x/sync/errgroup"
)

func murmur2(data []byte) uint32 {
	const seed uint32 = 0x9747b28c
	const m uint32 = 0x5bd1e995
	h := seed ^ uint32(len(data))
	i := 0
	for n := len(data); n >= 4; n -= 4 {
		k := binary.LittleEndian.Uint32(data[i:])
		i += 4
		k *= m
		k ^= k >> 24
		k *= m
		h *= m
		h ^= k
	}
	switch len(data) - i {
	case 3:
		h ^= uint32(data[i+2]) << 16
		fallthrough
	case 2:
		h ^= uint32(data[i+1]) << 8
		fallthrough
	case 1:
		h ^= uint32(data[i])
		h *= m
	}
	h ^= h >> 13
	h *= m
	h ^= h >> 15
	return h & 0x7fffffff
}

func partitionOfKey(key string, numPartitions int) int32 {
	return int32(murmur2([]byte(key)) % uint32(numPartitions))
}

func loadFullWorkspaces(ctx context.Context, workspaceIDs []string) error {
	g, ctx := errgroup.WithContext(ctx)

	for _, workspaceID := range workspaceIDs {
		wsID := workspaceID // capture loop variable
		g.Go(func() error {
			if workspace.Exists(wsID) {
				return nil
			}

			fullWorkspace, err := db.LoadWorkspace(ctx, wsID)
			if err != nil {
				return fmt.Errorf("failed to load workspace %s: %w", wsID, err)
			}
			workspace.Set(wsID, fullWorkspace)
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return fmt.Errorf("failed to load full workspaces: %w", err)
	}
	return nil
}

func initWorkspaces(ctx context.Context, assignedPartitions map[int32]struct{}, topicPartitionCount int) error {
	workspaceIDs, err := db.GetWorkspaceIDs(ctx)
	if err != nil {
		return err
	}

	assignedWorkspaceIDs := make([]string, 0)
	for _, workspaceID := range workspaceIDs {
		partition := partitionOfKey(workspaceID, topicPartitionCount)
		if _, ok := assignedPartitions[partition]; ok {
			assignedWorkspaceIDs = append(assignedWorkspaceIDs, workspaceID)
		}
	}

	return loadFullWorkspaces(ctx, assignedWorkspaceIDs)
}
