package versionanyapproval

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
	"workspace-engine/pkg/model"
)

var _ ApprovalRecord = (*VersionAnyApprovalRecord)(nil)

// VersionAnyApprovalRecord represents a record for the version-any-approval rule.
// It is used to track the approval status of a version for a given environment, for use by the version-any-approval rule.
// There can only be one record per version and environment per user.
type VersionAnyApprovalRecord struct {
	id            string
	versionID     string
	environmentID string
	userID        string
	status        ApprovalRecordStatus
	approvedAt    *time.Time
	reason        *string
	createdAt     time.Time
	updatedAt     time.Time
}

type versionAnyApprovalRecordBuilder struct {
	id            string
	versionID     string
	environmentID string
	userID        string
	status        ApprovalRecordStatus
	reason        *string
}

func NewVersionAnyApprovalRecordBuilder() *versionAnyApprovalRecordBuilder {
	return &versionAnyApprovalRecordBuilder{
		id:            "",
		versionID:     "",
		environmentID: "",
		userID:        "",
		status:        "",
		reason:        nil,
	}
}

func (b *versionAnyApprovalRecordBuilder) WithID(id string) *versionAnyApprovalRecordBuilder {
	b.id = id
	return b
}

func (b *versionAnyApprovalRecordBuilder) WithVersionID(versionID string) *versionAnyApprovalRecordBuilder {
	b.versionID = versionID
	return b
}

func (b *versionAnyApprovalRecordBuilder) WithEnvironmentID(environmentID string) *versionAnyApprovalRecordBuilder {
	b.environmentID = environmentID
	return b
}

func (b *versionAnyApprovalRecordBuilder) WithUserID(userID string) *versionAnyApprovalRecordBuilder {
	b.userID = userID
	return b
}

func (b *versionAnyApprovalRecordBuilder) WithStatus(status ApprovalRecordStatus) *versionAnyApprovalRecordBuilder {
	b.status = status
	return b
}

func (b *versionAnyApprovalRecordBuilder) WithReason(reason *string) *versionAnyApprovalRecordBuilder {
	b.reason = reason
	return b
}

func (b *versionAnyApprovalRecordBuilder) Build() *VersionAnyApprovalRecord {
	return &VersionAnyApprovalRecord{
		id:            b.id,
		versionID:     b.versionID,
		environmentID: b.environmentID,
		userID:        b.userID,
		status:        b.status,
		reason:        b.reason,
		createdAt:     time.Now().UTC(),
		updatedAt:     time.Now().UTC(),
	}
}

func (v VersionAnyApprovalRecord) GetID() string {
	return v.id
}

func (v VersionAnyApprovalRecord) GetVersionID() string {
	return v.versionID
}

func (v VersionAnyApprovalRecord) GetEnvironmentID() string {
	return v.environmentID
}

func (v VersionAnyApprovalRecord) GetUserID() string {
	return v.userID
}

func (v VersionAnyApprovalRecord) GetStatus() ApprovalRecordStatus {
	return v.status
}

func (v VersionAnyApprovalRecord) IsApproved() bool {
	return v.status == ApprovalRecordStatusApproved
}

func (v VersionAnyApprovalRecord) GetApprovedAt() *time.Time {
	return v.approvedAt
}

func (v VersionAnyApprovalRecord) GetReason() *string {
	return v.reason
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

func (v *VersionAnyApprovalRecordRepository) getRecordByID(id string) *VersionAnyApprovalRecord {
	for _, environmentRecords := range v.records {
		for _, records := range environmentRecords {
			for _, r := range records {
				if r.id == id {
					return r
				}
			}
		}
	}
	return nil
}

func (v *VersionAnyApprovalRecordRepository) validateRecord(record *VersionAnyApprovalRecord) error {
	if record == nil {
		return fmt.Errorf("record is nil")
	}

	if record.id == "" {
		return fmt.Errorf("record ID is empty")
	}

	if record.environmentID == "" {
		return fmt.Errorf("environment ID is empty")
	}

	if record.versionID == "" {
		return fmt.Errorf("version ID is empty")
	}

	if record.userID == "" {
		return fmt.Errorf("user ID is empty")
	}

	return nil
}

func (v *VersionAnyApprovalRecordRepository) Create(ctx context.Context, record *VersionAnyApprovalRecord) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if err := v.validateRecord(record); err != nil {
		return err
	}

	environmentID := record.environmentID
	versionID := record.versionID

	if _, ok := v.records[versionID]; !ok {
		v.records[versionID] = make(map[string][]*VersionAnyApprovalRecord)
	}

	if _, ok := v.records[versionID][environmentID]; !ok {
		v.records[versionID][environmentID] = make([]*VersionAnyApprovalRecord, 0)
	}

	if v.getRecordByID(record.id) != nil {
		return fmt.Errorf("record already exists")
	}

	currentRecords := v.records[versionID][environmentID]
	for _, r := range currentRecords {
		if r == nil {
			continue
		}

		if r.userID == record.userID {
			return fmt.Errorf("record already exists for user")
		}
	}

	if record.createdAt.IsZero() {
		record.createdAt = time.Now().UTC()
	}
	if record.updatedAt.IsZero() {
		record.updatedAt = time.Now().UTC()
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

				if r.id != recordID {
					continue
				}

				newRecords := make([]*VersionAnyApprovalRecord, 0, len(records)-1)
				for _, r := range records {
					if r.id != recordID {
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

	if err := v.validateRecord(record); err != nil {
		return err
	}

	existingRecord := v.getRecordByID(record.id)
	if existingRecord == nil {
		return fmt.Errorf("record not found")
	}

	if existingRecord.environmentID != record.environmentID {
		return fmt.Errorf("environment ID mismatch")
	}

	if existingRecord.versionID != record.versionID {
		return fmt.Errorf("version ID mismatch")
	}

	if existingRecord.userID != record.userID {
		return fmt.Errorf("user ID mismatch")
	}

	existingRecord.status = record.status
	existingRecord.approvedAt = record.approvedAt
	existingRecord.reason = record.reason
	ts := record.updatedAt
	if ts.Equal(existingRecord.updatedAt) || ts.Before(existingRecord.updatedAt) {
		ts = time.Now().UTC()
	}
	existingRecord.updatedAt = ts

	return nil
}

func (v *VersionAnyApprovalRecordRepository) Upsert(ctx context.Context, record *VersionAnyApprovalRecord) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if err := v.validateRecord(record); err != nil {
		return err
	}

	environmentID := record.environmentID
	versionID := record.versionID

	existingRecord := v.getRecordByID(record.id)
	if existingRecord != nil {
		if existingRecord.environmentID != record.environmentID {
			return fmt.Errorf("environment ID mismatch")
		}

		if existingRecord.versionID != record.versionID {
			return fmt.Errorf("version ID mismatch")
		}

		if existingRecord.userID != record.userID {
			return fmt.Errorf("user ID mismatch")
		}

		existingRecord.status = record.status
		existingRecord.approvedAt = record.approvedAt
		existingRecord.reason = record.reason
		ts := record.updatedAt
		if ts.Equal(existingRecord.updatedAt) || ts.Before(existingRecord.updatedAt) {
			ts = time.Now().UTC()
		}
		existingRecord.updatedAt = ts
		return nil
	}

	if _, ok := v.records[versionID]; !ok {
		v.records[versionID] = make(map[string][]*VersionAnyApprovalRecord)
	}

	if _, ok := v.records[versionID][environmentID]; !ok {
		v.records[versionID][environmentID] = make([]*VersionAnyApprovalRecord, 0)
	}

	if record.createdAt.IsZero() {
		record.createdAt = time.Now().UTC()
	}
	if record.updatedAt.IsZero() {
		record.updatedAt = time.Now().UTC()
	}

	for _, r := range v.records[versionID][environmentID] {
		if r.userID == record.userID {
			return fmt.Errorf("record already exists for user")
		}
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
				if r.id == recordID {
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
				if r.id == recordID {
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
		return allRecords[i].updatedAt.After(allRecords[j].updatedAt)
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
		return records[i].updatedAt.After(records[j].updatedAt)
	})
	return records
}
