package mapping

import (
	"fmt"
	"github.com/ctrlplanedev/selector-engine/pkg/model/resource"
	"time"

	"github.com/ctrlplanedev/selector-engine/pkg/model"
	"github.com/ctrlplanedev/selector-engine/pkg/model/selector"
	pb "github.com/ctrlplanedev/selector-engine/pkg/pb/proto"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// FromProtoResource converts a protobuf Resource to a model Resource
func FromProtoResource(proto *pb.Resource) resource.Resource {
	if proto == nil {
		return resource.Resource{}
	}

	mod := resource.Resource{
		ID:          proto.GetId(),
		WorkspaceID: proto.GetWorkspaceId(),
		Identifier:  proto.GetIdentifier(),
		Name:        proto.GetName(),
		Kind:        proto.GetKind(),
		Version:     proto.GetVersion(),
		Metadata:    make(map[string]string),
	}

	if proto.GetCreatedAt() != nil {
		mod.CreatedAt = proto.GetCreatedAt().AsTime()
	}
	if proto.GetLastSync() != nil {
		mod.LastSync = proto.GetLastSync().AsTime()
	}

	if proto.GetMetadata() != nil {
		for k, v := range proto.GetMetadata() {
			mod.Metadata[k] = v
		}
	}

	return mod
}

// ToProtoResource converts a model Resource to a protobuf Resource
func ToProtoResource(model resource.Resource) *pb.Resource {
	proto := &pb.Resource{
		Id:          model.ID,
		WorkspaceId: model.WorkspaceID,
		Identifier:  model.Identifier,
		Name:        model.Name,
		Kind:        model.Kind,
		Version:     model.Version,
		Metadata:    make(map[string]string),
	}

	if !model.CreatedAt.IsZero() {
		proto.CreatedAt = timestamppb.New(model.CreatedAt)
	}
	if !model.LastSync.IsZero() {
		proto.LastSync = timestamppb.New(model.LastSync)
	}

	if model.Metadata != nil {
		for k, v := range model.Metadata {
			proto.Metadata[k] = v
		}
	}

	return proto
}

func FromProtoEntityType(value string) (selector.EntityType, error) {
	for _, et := range selector.AllEntityTypes {
		if string(et) == value {
			return et, nil
		}
	}
	return "", fmt.Errorf("unknown entity type: %s", value)
}

// FromProtoResourceSelector converts a protobuf ResourceSelector to a model ResourceSelector
func FromProtoResourceSelector(proto *pb.ResourceSelector) (selector.ResourceSelector, error) {
	if proto == nil {
		return selector.ResourceSelector{}, nil
	}

	entityType, err := FromProtoEntityType(proto.GetEntityType())
	if err != nil {
		return selector.ResourceSelector{}, fmt.Errorf("failed to convert entity type: %w", err)
	}

	m := selector.ResourceSelector{
		ID:          proto.GetId(),
		WorkspaceID: proto.GetWorkspaceId(),
		EntityType:  entityType,
	}

	if proto.GetCondition() != nil {
		cond, err := fromProtoCondition(proto.GetCondition())
		if err != nil {
			return selector.ResourceSelector{}, fmt.Errorf("failed to convert selector: %w", err)
		}
		m.Condition = cond
	}

	return m, nil
}

// FromProtoMatch converts a protobuf Match to a model Match
func FromProtoMatch(proto *pb.Match) (model.Match, error) {
	if proto == nil {
		return model.Match{}, nil
	}

	mod := model.Match{
		Error:      proto.GetError(),
		Message:    proto.GetMessage(),
		SelectorID: proto.GetSelectorId(),
		ResourceID: proto.GetResourceId(),
	}

	if proto.GetResource() != nil {
		res := FromProtoResource(proto.GetResource())
		mod.Resource = &res
	}

	if proto.GetSelector() != nil {
		sel, err := FromProtoResourceSelector(proto.GetSelector())
		if err != nil {
			return model.Match{}, fmt.Errorf("failed to convert selector: %w", err)
		}
		mod.Selector = &sel
	}

	return mod, nil
}

// ToProtoMatch converts a model Match to a protobuf Match
func ToProtoMatch(mod model.Match) *pb.Match {
	proto := &pb.Match{
		Error:      mod.Error,
		Message:    mod.Message,
		SelectorId: mod.SelectorID,
		ResourceId: mod.ResourceID,
	}

	return proto
}

// FromProtoStatus converts a protobuf Status to a DTO Status
func FromProtoStatus(proto *pb.Status) model.Status {
	if proto == nil {
		return model.Status{}
	}

	return model.Status{
		Error:   proto.GetError(),
		Message: proto.GetMessage(),
	}
}

// ToProtoStatus converts a DTO Status to a protobuf Status
func ToProtoStatus(mod model.Status) *pb.Status {
	return &pb.Status{
		Error:   mod.Error,
		Message: mod.Message,
	}
}

// FromProtoResourceRef converts a protobuf ResourceRef to a DTO ResourceRef (string)
func FromProtoResourceRef(proto *pb.ResourceRef) resource.ResourceRef {
	if proto == nil {
		return resource.ResourceRef{}
	}
	return resource.ResourceRef{
		ID:          proto.GetId(),
		WorkspaceID: proto.GetWorkspaceId(),
	}
}

// ToProtoResourceRef converts id (string) to a protobuf ResourceRef
func ToProtoResourceRef(ref resource.ResourceRef) *pb.ResourceRef {
	return &pb.ResourceRef{
		Id:          ref.ID,
		WorkspaceId: ref.WorkspaceID,
	}
}

func toProtoSelectorEntityType(entityType selector.EntityType) string {
	return string(entityType)
}

// FromProtoResourceSelectorRef converts a protobuf ResourceSelectorRef to a model ResourceSelectorRef
func FromProtoResourceSelectorRef(proto *pb.ResourceSelectorRef) selector.ResourceSelectorRef {
	if proto == nil {
		return selector.ResourceSelectorRef{}
	}
	return selector.ResourceSelectorRef{
		ID:          proto.GetId(),
		WorkspaceID: proto.GetWorkspaceId(),
		EntityType:  selector.EntityType(proto.GetEntityType()),
	}
}

// ToProtoResourceSelectorRef converts a ResourceSelectorRef ID (string) to a protobuf ResourceSelectorRef
func ToProtoResourceSelectorRef(ref selector.ResourceSelectorRef) *pb.ResourceSelectorRef {
	return &pb.ResourceSelectorRef{
		Id:          ref.ID,
		WorkspaceId: ref.WorkspaceID,
		EntityType:  toProtoSelectorEntityType(ref.EntityType),
	}
}

func fromProtoColumnOperator(op pb.ColumnOperator) selector.ColumnOperator {
	switch op {
	case pb.ColumnOperator_COLUMN_OPERATOR_EQUALS:
		return selector.ColumnOperatorEquals
	case pb.ColumnOperator_COLUMN_OPERATOR_STARTS_WITH:
		return selector.ColumnOperatorStartsWith
	case pb.ColumnOperator_COLUMN_OPERATOR_ENDS_WITH:
		return selector.ColumnOperatorEndsWith
	case pb.ColumnOperator_COLUMN_OPERATOR_CONTAINS:
		return selector.ColumnOperatorContains
	default:
		return selector.ColumnOperatorEquals
	}
}

func fromProtoIdOperator(op string) (selector.IdOperator, error) {
	if op == string(selector.IdOperatorEquals) {
		return selector.IdOperatorEquals, nil
	}
	return "", fmt.Errorf("unknown ID operator: %s", op)
}

func fromProtoMetadataOperator(op pb.MetadataOperator) (selector.MetadataOperator, error) {
	switch op {
	case pb.MetadataOperator_METADATA_OPERATOR_EQUALS:
		return selector.MetadataOperatorEquals, nil
	case pb.MetadataOperator_METADATA_OPERATOR_NULL:
		return selector.MetadataOperatorNull, nil
	case pb.MetadataOperator_METADATA_OPERATOR_STARTS_WITH:
		return selector.MetadataOperatorStartsWith, nil
	case pb.MetadataOperator_METADATA_OPERATOR_ENDS_WITH:
		return selector.MetadataOperatorEndsWith, nil
	case pb.MetadataOperator_METADATA_OPERATOR_CONTAINS:
		return selector.MetadataOperatorContains, nil
	default:
		return "", fmt.Errorf("unknown metadata operator: %v", op)
	}
}

func fromProtoComparisonOperator(op pb.ComparisonOperator) (selector.ComparisonOperator, error) {
	switch op {
	case pb.ComparisonOperator_COMPARISON_OPERATOR_AND:
		return selector.ComparisonOperatorAnd, nil
	case pb.ComparisonOperator_COMPARISON_OPERATOR_OR:
		return selector.ComparisonOperatorOr, nil
	}
	return "", fmt.Errorf("unknown comparison operator: %v", op)
}

func fromProtoDateOperator(op pb.DateOperator) (selector.DateOperator, error) {
	switch op {
	case pb.DateOperator_DATE_OPERATOR_AFTER:
		return selector.DateOperatorAfter, nil
	case pb.DateOperator_DATE_OPERATOR_BEFORE:
		return selector.DateOperatorBefore, nil
	case pb.DateOperator_DATE_OPERATOR_BEFORE_OR_ON:
		return selector.DateOperatorBeforeOrOn, nil
	case pb.DateOperator_DATE_OPERATOR_AFTER_OR_ON:
		return selector.DateOperatorAfterOrOn, nil
	default:
		return "", fmt.Errorf("unknown date operator: %v", op)
	}
}

func fromProtoDateField(field pb.DateField) (selector.DateField, error) {
	switch field {
	case pb.DateField_DATE_FIELD_CREATED_AT:
		return selector.DateFieldCreatedAt, nil
	case pb.DateField_DATE_FIELD_UPDATED_AT:
		return selector.DateFieldUpdatedAt, nil
	default:
		return "", fmt.Errorf("unknown date field: %v", field)
	}
}

// Helper functions for selector conversion (simplified approach)
func fromProtoCondition(proto *pb.Condition) (selector.Condition, error) {
	if proto == nil {
		return nil, nil
	}
	var err error

	if cond := proto.GetIdCondition(); cond != nil {
		var idOp selector.IdOperator
		if idOp, err = fromProtoIdOperator(cond.GetOperator()); err != nil {
			return nil, fmt.Errorf("failed to convert ID operator: %w", err)
		}
		return &selector.IDCondition{
			Value:     cond.GetValue(),
			Operator:  idOp,
			TypeField: selector.ConditionTypeID,
		}, nil
	}

	if cond := proto.GetNameCondition(); cond != nil {
		return &selector.NameCondition{
			Value:     cond.GetValue(),
			Operator:  fromProtoColumnOperator(cond.GetOperator()),
			TypeField: selector.ConditionTypeName,
		}, nil
	}

	if cond := proto.GetMetadataValueCondition(); cond != nil {
		var metadataOp selector.MetadataOperator
		if metadataOp, err = fromProtoMetadataOperator(cond.GetOperator()); err != nil {
			return nil, fmt.Errorf("failed to convert metadata operator: %w", err)
		}
		return &selector.MetadataValueCondition{
			Key:       cond.GetKey(),
			Value:     cond.GetValue(),
			Operator:  metadataOp,
			TypeField: selector.ConditionTypeMetadata,
		}, nil
	}

	if cond := proto.GetMetadataNullCondition(); cond != nil {
		return &selector.MetadataNullCondition{
			Key:       cond.GetKey(),
			Operator:  selector.MetadataOperatorNull,
			TypeField: selector.ConditionTypeMetadata,
		}, nil
	}

	if cond := proto.GetComparisonCondition(); cond != nil {
		operator, err := fromProtoComparisonOperator(cond.GetOperator())
		if err != nil {
			return nil, err
		}

		conditions := make([]selector.Condition, len(cond.GetConditions()))
		for i, c := range cond.GetConditions() {
			cond, err := fromProtoCondition(c)
			if err != nil {
				return nil, fmt.Errorf("failed to convert selector at index %d: %w", i, err)
			}
			conditions[i] = cond
		}
		return &selector.ComparisonCondition{
			Operator:   operator,
			Conditions: conditions,
			TypeField:  selector.ConditionTypeComparison,
		}, nil
	}

	if cond := proto.GetDateCondition(); cond != nil {
		operator, err := fromProtoDateOperator(cond.GetOperator())
		if err != nil {
			return nil, err
		}
		var valueTime time.Time
		if valueTime, err = ParseISO8601Date(cond.GetValue()); err != nil {
			return nil, err
		}
		var dateField selector.DateField
		if dateField, err = fromProtoDateField(cond.GetDateField()); err != nil {
			return nil, fmt.Errorf("failed to convert date field: %w", err)
		}
		return &selector.DateCondition{
			Value:     valueTime,
			Operator:  operator,
			TypeField: selector.ConditionTypeDate,
			DateField: dateField,
		}, nil
	}

	if cond := proto.GetVersionCondition(); cond != nil {
		return &selector.VersionCondition{
			Value:     cond.GetValue(),
			Operator:  fromProtoColumnOperator(cond.GetOperator()),
			TypeField: selector.ConditionTypeVersion,
		}, nil
	}

	return nil, fmt.Errorf("unknown selector: %v", proto.GetConditionType())
}

// ParseISO8601Date parses a date string in ISO-8601 format, mostly.
// It supports RFC3339, YYYY-MM-DD, and full date-time with fractional seconds.
func ParseISO8601Date(date string) (time.Time, error) {
	var err error
	var t time.Time
	t, err = time.Parse(time.RFC3339, date)
	if err != nil {
		t, err = time.Parse("2006-01-02", date)
	}
	if err != nil {
		t, err = time.Parse("2006-01-02T15:04:05.999999999", date)
	}
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid date format, expected ISO-8601: %v", err)
	}
	return t, nil
}
