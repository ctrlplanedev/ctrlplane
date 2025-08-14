package versionanyapproval

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
	"workspace-engine/pkg/model"
)

type VersionAnyApprovalRecordStatus string

const (
	VersionAnyApprovalRecordStatusApproved VersionAnyApprovalRecordStatus = "approved"
	VersionAnyApprovalRecordStatusRejected VersionAnyApprovalRecordStatus = "rejected"
)

// VersionAnyApprovalRecord represents a record for the version-any-approval rule.
// It is used to track the approval status of a version for a given environment, for use by the version-any-approval rule.
// There can only be one record per version and environment per user.
type VersionAnyApprovalRecord struct {
	ID            string
	VersionID     string
	EnvironmentID string
	UserID        string
	Status        VersionAnyApprovalRecordStatus
	ApprovedAt    *time.Time
	Reason        *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func (v VersionAnyApprovalRecord) GetID() string {
	return v.ID
}

var _ model.Repository[VersionAnyApprovalRecord] = (*VersionAnyApprovalRecordRepository)(nil)

// VersionAnyApprovalRecordRepository is a repository for all version-any-approval records.
type VersionAnyApprovalRecordRepository struct {
	records map[string]map[string][]*VersionAnyApprovalRecord // versionID -> environmentID -> array of records
	mu      sync.RWMutex
}

func NewVersionAnyApprovalRecordRepository() *VersionAnyApprovalRecordRepository {
	return &VersionAnyApprovalRecordRepository{
		records: make(map[string]map[string][]*VersionAnyApprovalRecord),
	}
}

func (v *VersionAnyApprovalRecordRepository) Create(ctx context.Context, record *VersionAnyApprovalRecord) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if record == nil {
		return fmt.Errorf("record is nil")
	}

	if record.ID == "" {
		return fmt.Errorf("record ID is empty")
	}

	if record.EnvironmentID == "" {
		return fmt.Errorf("environment ID is empty")
	}

	if record.VersionID == "" {
		return fmt.Errorf("version ID is empty")
	}

	if record.UserID == "" {
		return fmt.Errorf("user ID is empty")
	}

	environmentID := record.EnvironmentID
	versionID := record.VersionID

	if _, ok := v.records[versionID]; !ok {
		v.records[versionID] = make(map[string][]*VersionAnyApprovalRecord)
	}

	if _, ok := v.records[versionID][environmentID]; !ok {
		v.records[versionID][environmentID] = make([]*VersionAnyApprovalRecord, 0)
	}

	currentRecords := v.records[versionID][environmentID]
	for _, r := range currentRecords {
		if r == nil {
			continue
		}

		if r.ID == record.ID {
			return fmt.Errorf("record already exists")
		}

		if r.UserID == record.UserID {
			return fmt.Errorf("record already exists for user")
		}
	}

	if record.CreatedAt.IsZero() {
		record.CreatedAt = time.Now().UTC()
	}
	if record.UpdatedAt.IsZero() {
		record.UpdatedAt = time.Now().UTC()
	}

	v.records[versionID][environmentID] = append(currentRecords, record)
	return nil
}

func (v *VersionAnyApprovalRecordRepository) Delete(ctx context.Context, recordID string) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	for versionID, environmentRecords := range v.records {
		for environmentID, records := range environmentRecords {
			for _, r := range records {
				if r == nil {
					continue
				}

				if r.ID != recordID {
					continue
				}

				newRecords := make([]*VersionAnyApprovalRecord, 0, len(records)-1)
				for _, r := range records {
					if r.ID != recordID {
						newRecords = append(newRecords, r)
					}
				}
				v.records[versionID][environmentID] = newRecords
			}
		}
	}

	return nil
}

func (v *VersionAnyApprovalRecordRepository) Update(ctx context.Context, record *VersionAnyApprovalRecord) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if record == nil {
		return fmt.Errorf("record is nil")
	}

	environmentID := record.EnvironmentID
	versionID := record.VersionID

	if _, ok := v.records[versionID]; !ok {
		return fmt.Errorf("version not found")
	}

	if _, ok := v.records[versionID][environmentID]; !ok {
		return fmt.Errorf("environment not found")
	}

	currentRecords := v.records[versionID][environmentID]
	for _, r := range currentRecords {
		if r == nil {
			continue
		}

		if r.ID != record.ID {
			continue
		}

		r.Status = record.Status
		r.ApprovedAt = record.ApprovedAt
		r.Reason = record.Reason
		if record.UpdatedAt.Equal(r.UpdatedAt) || record.UpdatedAt.Before(r.UpdatedAt) {
			record.UpdatedAt = time.Now().UTC()
		}
		r.UpdatedAt = record.UpdatedAt

		return nil
	}

	return fmt.Errorf("record not found")
}

func (v *VersionAnyApprovalRecordRepository) Upsert(ctx context.Context, record *VersionAnyApprovalRecord) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if record == nil {
		return fmt.Errorf("record is nil")
	}

	environmentID := record.EnvironmentID
	versionID := record.VersionID
	userID := record.UserID

	if _, ok := v.records[versionID]; !ok {
		v.records[versionID] = make(map[string][]*VersionAnyApprovalRecord)
	}

	if _, ok := v.records[versionID][environmentID]; !ok {
		v.records[versionID][environmentID] = make([]*VersionAnyApprovalRecord, 0)
	}

	for _, r := range v.records[versionID][environmentID] {
		if r.UserID == userID {
			r.Status = record.Status
			r.ApprovedAt = record.ApprovedAt
			r.Reason = record.Reason
			if record.UpdatedAt.Equal(r.UpdatedAt) || record.UpdatedAt.Before(r.UpdatedAt) {
				record.UpdatedAt = time.Now().UTC()
			}
			r.UpdatedAt = record.UpdatedAt

			return nil
		}
	}

	if record.CreatedAt.IsZero() {
		record.CreatedAt = time.Now().UTC()
	}
	if record.UpdatedAt.IsZero() {
		record.UpdatedAt = time.Now().UTC()
	}

	v.records[versionID][environmentID] = append(v.records[versionID][environmentID], record)

	return nil
}

func (v *VersionAnyApprovalRecordRepository) Exists(ctx context.Context, recordID string) bool {
	v.mu.RLock()
	defer v.mu.RUnlock()

	for _, environmentRecords := range v.records {
		for _, records := range environmentRecords {
			for _, r := range records {
				if r.ID == recordID {
					return true
				}
			}
		}
	}
	return false
}

func (v *VersionAnyApprovalRecordRepository) Get(ctx context.Context, recordID string) *VersionAnyApprovalRecord {
	v.mu.RLock()
	defer v.mu.RUnlock()

	for _, environmentRecords := range v.records {
		for _, records := range environmentRecords {
			for _, r := range records {
				if r.ID == recordID {
					return r
				}
			}
		}
	}
	return nil
}

// GetAll returns all records, sorted by updatedAt in descending order (newest first)
func (v *VersionAnyApprovalRecordRepository) GetAll(ctx context.Context) []*VersionAnyApprovalRecord {
	v.mu.RLock()
	defer v.mu.RUnlock()

	allRecords := make([]*VersionAnyApprovalRecord, 0)
	for _, environmentRecords := range v.records {
		for _, records := range environmentRecords {
			allRecords = append(allRecords, records...)
		}
	}
	sort.Slice(allRecords, func(i, j int) bool {
		return allRecords[i].UpdatedAt.After(allRecords[j].UpdatedAt)
	})
	return allRecords
}

// GetAllForVersionAndEnvironment returns all records for a given version and environment, sorted by updatedAt in descending order (newest first)
func (v *VersionAnyApprovalRecordRepository) GetAllForVersionAndEnvironment(ctx context.Context, versionID string, environmentID string) []*VersionAnyApprovalRecord {
	v.mu.RLock()
	defer v.mu.RUnlock()

	var records []*VersionAnyApprovalRecord
	if _, ok := v.records[versionID][environmentID]; ok {
		records = make([]*VersionAnyApprovalRecord, len(v.records[versionID][environmentID]))
		copy(records, v.records[versionID][environmentID])
	}
	sort.Slice(records, func(i, j int) bool {
		return records[i].UpdatedAt.After(records[j].UpdatedAt)
	})
	return records
}
