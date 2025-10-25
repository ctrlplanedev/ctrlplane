package file

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"workspace-engine/pkg/persistence"
)

// Store is a file-based implementation of persistence.Store using JSONL format.
// Each namespace gets its own .jsonl file with one JSON object per line.
// Supports automatic compaction to keep only the latest state per entity.
type Store struct {
	baseDir  string
	registry *EntityRegistry
	mu       sync.RWMutex
}

// fileChange is the on-disk representation of a persistence.Change
type fileChange struct {
	Namespace  string          `json:"namespace"`
	ChangeType string          `json:"changeType"`
	EntityType string          `json:"entityType"`
	EntityID   string          `json:"entityID"`
	Entity     json.RawMessage `json:"entity"`
	Timestamp  time.Time       `json:"timestamp"`
}

// NewStore creates a new file-based persistence store
func NewStore(baseDir string) (*Store, error) {
	// Create base directory if it doesn't exist
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create base directory: %w", err)
	}

	return &Store{
		baseDir:  baseDir,
		registry: NewEntityRegistry(),
	}, nil
}

// RegisterEntityType registers an entity type with its factory function
func (s *Store) RegisterEntityType(entityType string, factory EntityFactory) {
	s.registry.Register(entityType, factory)
}

// Save persists changes to disk in JSONL format
func (s *Store) Save(ctx context.Context, changes persistence.Changes) error {
	if len(changes) == 0 {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Group changes by namespace
	byNamespace := make(map[string][]persistence.Change)
	for _, change := range changes {
		byNamespace[change.Namespace] = append(byNamespace[change.Namespace], change)
	}

	// Write each namespace to its file
	for namespace, nsChanges := range byNamespace {
		if err := s.appendChanges(namespace, nsChanges); err != nil {
			return fmt.Errorf("failed to save changes for namespace %s: %w", namespace, err)
		}
	}

	return nil
}

// appendChanges appends changes to a namespace file
func (s *Store) appendChanges(namespace string, changes []persistence.Change) error {
	filePath := s.getFilePath(namespace)

	// Open file for appending
	f, err := os.OpenFile(filePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer f.Close()

	encoder := json.NewEncoder(f)
	for _, change := range changes {
		entityType, entityID := change.Entity.CompactionKey()

		// Set timestamp if not provided
		timestamp := change.Timestamp
		if timestamp.IsZero() {
			timestamp = time.Now()
		}

		entityJSON, err := json.Marshal(change.Entity)
		if err != nil {
			return fmt.Errorf("failed to marshal entity: %w", err)
		}

		fc := fileChange{
			Namespace:  change.Namespace,
			ChangeType: string(change.ChangeType),
			EntityType: entityType,
			EntityID:   entityID,
			Entity:     entityJSON,
			Timestamp:  timestamp,
		}

		if err := encoder.Encode(fc); err != nil {
			return fmt.Errorf("failed to encode change: %w", err)
		}
	}

	return nil
}

// Load retrieves the compacted state for a namespace
func (s *Store) Load(ctx context.Context, namespace string) (persistence.Changes, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filePath := s.getFilePath(namespace)

	f, err := os.Open(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return persistence.Changes{}, nil
		}
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer f.Close()

	// Read all changes and deduplicate (keep latest per entity)
	latest := make(map[string]fileChange)

	scanner := bufio.NewScanner(f)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		var fc fileChange
		if err := json.Unmarshal(scanner.Bytes(), &fc); err != nil {
			return nil, fmt.Errorf("failed to unmarshal line %d: %w", lineNum, err)
		}

		key := fc.EntityType + ":" + fc.EntityID

		// Keep latest by timestamp (automatic compaction)
		if existing, exists := latest[key]; !exists || fc.Timestamp.After(existing.Timestamp) {
			latest[key] = fc
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading file: %w", err)
	}

	// Convert to Changes
	result := make(persistence.Changes, 0, len(latest))
	for _, fc := range latest {
		entity, err := s.registry.Unmarshal(fc.EntityType, fc.Entity)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal entity type %s: %w", fc.EntityType, err)
		}

		result = append(result, persistence.Change{
			Namespace:  fc.Namespace,
			ChangeType: persistence.ChangeType(fc.ChangeType),
			Entity:     entity,
			Timestamp:  fc.Timestamp,
		})
	}

	return result, nil
}

// Compact performs manual compaction on a namespace file
// This rewrites the file with only the latest change per entity
func (s *Store) Compact(ctx context.Context, namespace string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Load compacted changes
	changes, err := s.loadWithoutLock(namespace)
	if err != nil {
		return err
	}

	if len(changes) == 0 {
		return nil
	}

	filePath := s.getFilePath(namespace)
	tempPath := filePath + ".tmp"

	// Write compacted changes to temp file
	f, err := os.Create(tempPath)
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}

	encoder := json.NewEncoder(f)
	for _, change := range changes {
		entityType, entityID := change.Entity.CompactionKey()

		entityJSON, err := json.Marshal(change.Entity)
		if err != nil {
			f.Close()
			os.Remove(tempPath)
			return fmt.Errorf("failed to marshal entity: %w", err)
		}

		fc := fileChange{
			Namespace:  change.Namespace,
			ChangeType: string(change.ChangeType),
			EntityType: entityType,
			EntityID:   entityID,
			Entity:     entityJSON,
			Timestamp:  change.Timestamp,
		}

		if err := encoder.Encode(fc); err != nil {
			f.Close()
			os.Remove(tempPath)
			return fmt.Errorf("failed to encode change: %w", err)
		}
	}

	if err := f.Close(); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to close temp file: %w", err)
	}

	// Atomic rename
	if err := os.Rename(tempPath, filePath); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to rename temp file: %w", err)
	}

	return nil
}

// loadWithoutLock loads changes without acquiring the lock (internal use)
func (s *Store) loadWithoutLock(namespace string) (persistence.Changes, error) {
	filePath := s.getFilePath(namespace)

	f, err := os.Open(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return persistence.Changes{}, nil
		}
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer f.Close()

	latest := make(map[string]fileChange)

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		var fc fileChange
		if err := json.Unmarshal(scanner.Bytes(), &fc); err != nil {
			return nil, err
		}

		key := fc.EntityType + ":" + fc.EntityID
		if existing, exists := latest[key]; !exists || fc.Timestamp.After(existing.Timestamp) {
			latest[key] = fc
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	result := make(persistence.Changes, 0, len(latest))
	for _, fc := range latest {
		entity, err := s.registry.Unmarshal(fc.EntityType, fc.Entity)
		if err != nil {
			return nil, err
		}

		result = append(result, persistence.Change{
			Namespace:  fc.Namespace,
			ChangeType: persistence.ChangeType(fc.ChangeType),
			Entity:     entity,
			Timestamp:  fc.Timestamp,
		})
	}

	return result, nil
}

// getFilePath returns the file path for a namespace
func (s *Store) getFilePath(namespace string) string {
	return filepath.Join(s.baseDir, namespace+".jsonl")
}

// Close closes the store (no-op for file-based implementation)
func (s *Store) Close() error {
	return nil
}

// ListNamespaces returns all namespaces in the store
func (s *Store) ListNamespaces() ([]string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entries, err := os.ReadDir(s.baseDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory: %w", err)
	}

	var namespaces []string
	for _, entry := range entries {
		if !entry.IsDir() && filepath.Ext(entry.Name()) == ".jsonl" {
			namespace := entry.Name()[:len(entry.Name())-6] // Remove .jsonl extension
			namespaces = append(namespaces, namespace)
		}
	}

	return namespaces, nil
}

