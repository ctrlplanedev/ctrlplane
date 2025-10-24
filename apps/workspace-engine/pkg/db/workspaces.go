package db

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

const WORKSPACE_SELECT_QUERY = `
	SELECT id FROM workspace
`

func GetWorkspaceIDs(ctx context.Context) ([]string, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, WORKSPACE_SELECT_QUERY)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	workspaceIDs := make([]string, 0)
	for rows.Next() {
		var workspaceID string
		err := rows.Scan(&workspaceID)
		if err != nil {
			return nil, err
		}
		workspaceIDs = append(workspaceIDs, workspaceID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return workspaceIDs, nil
}

const WORKSPACE_EXISTS_QUERY = `
	SELECT EXISTS(SELECT 1 FROM workspace WHERE id = $1)
`

func WorkspaceExists(ctx context.Context, workspaceId string) (bool, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return false, err
	}
	defer db.Release()

	var exists bool
	err = db.QueryRow(ctx, WORKSPACE_EXISTS_QUERY, workspaceId).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func GetAllWorkspaceIDs(ctx context.Context) ([]string, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	const query = `
		SELECT id FROM workspace
	`
	rows, err := db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var workspaceIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		workspaceIDs = append(workspaceIDs, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return workspaceIDs, nil
}

type WorkspaceSnapshot struct {
	WorkspaceID   string
	Path          string
	Timestamp     time.Time
	Partition     int32
	NumPartitions int32
	Offset        int64
}

const WORKSPACE_SNAPSHOT_SELECT_QUERY = `
	SELECT 
		workspace_id, 
		path, 
		timestamp, 
		partition, 
		num_partitions, 
		offset 
	FROM workspace_snapshot
	WHERE workspace_id = $1
	ORDER BY offset DESC LIMIT 1
`

func GetWorkspaceSnapshot(ctx context.Context, workspaceID string) (*WorkspaceSnapshot, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	workspaceSnapshot := &WorkspaceSnapshot{}
	err = db.QueryRow(ctx, WORKSPACE_SNAPSHOT_SELECT_QUERY, workspaceID).Scan(
		&workspaceSnapshot.WorkspaceID,
		&workspaceSnapshot.Path,
		&workspaceSnapshot.Timestamp,
		&workspaceSnapshot.Partition,
		&workspaceSnapshot.NumPartitions,
		&workspaceSnapshot.Offset,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return workspaceSnapshot, nil
}

func GetLatestWorkspaceSnapshots(ctx context.Context, workspaceIDs []string) (map[string]*WorkspaceSnapshot, error) {
	if len(workspaceIDs) == 0 {
		return nil, nil
	}

	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	const query = `
		SELECT DISTINCT ON (workspace_id) workspace_id, path, timestamp, partition, num_partitions, offset 
		FROM workspace_snapshot 
		WHERE workspace_id = ANY($1)
		ORDER BY workspace_id, offset DESC
	`
	rows, err := db.Query(ctx, query, workspaceIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var snapshots []*WorkspaceSnapshot
	for rows.Next() {
		var snapshot WorkspaceSnapshot
		err := rows.Scan(&snapshot.WorkspaceID, &snapshot.Path, &snapshot.Timestamp, &snapshot.Partition, &snapshot.NumPartitions, &snapshot.Offset)
		if err != nil {
			return nil, err
		}
		snapshots = append(snapshots, &snapshot)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	snapshotMap := make(map[string]*WorkspaceSnapshot)
	for _, snapshot := range snapshots {
		snapshotMap[snapshot.WorkspaceID] = snapshot
	}
	return snapshotMap, nil
}

const WORKSPACE_SNAPSHOT_INSERT_QUERY = `
	INSERT INTO workspace_snapshot (workspace_id, path, timestamp, partition, num_partitions, offset)
	VALUES ($1, $2, $3, $4, $5, $6)
`

func WriteWorkspaceSnapshot(ctx context.Context, snapshot *WorkspaceSnapshot) error {
	db, err := GetDB(ctx)
	if err != nil {
		return err
	}
	defer db.Release()

	_, err = db.Exec(ctx, WORKSPACE_SNAPSHOT_INSERT_QUERY, snapshot.WorkspaceID, snapshot.Path, snapshot.Timestamp, snapshot.Partition, snapshot.NumPartitions, snapshot.Offset)
	if err != nil {
		return err
	}
	return nil
}
