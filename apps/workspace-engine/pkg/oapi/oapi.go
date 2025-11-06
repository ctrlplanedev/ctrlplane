//go:generate sh -c "jsonnetfmt -i ../../oapi/spec/**/*.jsonnet"
//go:generate sh -c "jsonnet ../../oapi/spec/main.jsonnet > ../../oapi/openapi.json"
//go:generate go tool oapi-codegen -config ../../oapi/cfg.yaml ../../oapi/openapi.json

package oapi

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"

	"github.com/google/uuid"
)

func ReleaseTargetFromKey(key string) *ReleaseTarget {
	parts := strings.Split(key, "-")
	if len(parts) != 3 {
		return nil
	}
	return &ReleaseTarget{
		ResourceId:    parts[0],
		EnvironmentId: parts[1],
		DeploymentId:  parts[2],
	}
}

func (r *Release) ID() string {
	// Collect relevant fields for deterministic ID
	var sb strings.Builder
	sb.WriteString(r.Version.Id)
	sb.WriteString(r.Version.Tag)

	// Sort variable keys for determinism
	keys := make([]string, 0, len(r.Variables))
	for k := range r.Variables {
		keys = append(keys, k)
	}

	sort.Strings(keys)
	for _, k := range keys {
		sb.WriteString(k)
		sb.WriteString("=")
		sb.WriteString(toString(r.Variables[k]))
		sb.WriteString(";")
	}

	sb.WriteString(r.ReleaseTarget.Key())

	// Hash the concatenated string
	hash := sha256.Sum256([]byte(sb.String()))
	return hex.EncodeToString(hash[:])
}

func (r *Release) UUID() uuid.UUID {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte(r.ID()))
}

func toString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case int:
		return string(rune(t))
	case int64:
		return string(rune(t))
	case float64:
		return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%f", t), "0"), ".")
	case bool:
		if t {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprintf("%v", t)
	}
}

func (x *ReleaseTarget) Key() string {
	return x.ResourceId + "-" + x.EnvironmentId + "-" + x.DeploymentId
}

func (rv *ResourceVariable) ID() string {
	return rv.ResourceId + "-" + rv.Key
}

func (x *UserApprovalRecord) Key() string {
	return x.VersionId + x.UserId
}

func (j *Job) IsInProcessingState() bool {
	return j.Status == InProgress || j.Status == ActionRequired || j.Status == Pending
}

func (j *Job) IsInTerminalState() bool {
	return j.Status == Cancelled || j.Status == Skipped || j.Status == Successful || j.Status == Failure || j.Status == InvalidJobAgent || j.Status == InvalidIntegration || j.Status == ExternalRunNotFound
}

func (v *Value) GetType() (string, error) {
	// Try ReferenceValue - check that required fields are present
	if rv, err := v.AsReferenceValue(); err == nil {
		if rv.Reference != "" && rv.Path != nil {
			return "reference", nil
		}
	}

	// Try SensitiveValue - check that required fields are present
	if sv, err := v.AsSensitiveValue(); err == nil {
		if sv.ValueHash != "" {
			return "sensitive", nil
		}
	}

	// Try LiteralValue (fallback - anything else is a literal)
	if _, err := v.AsLiteralValue(); err == nil {
		return "literal", nil
	}

	return "", fmt.Errorf("unable to determine value type")
}
