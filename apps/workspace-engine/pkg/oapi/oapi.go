//go:generate go tool oapi-codegen -config ../../oapi/cfg.yaml ../../oapi/spec.yaml

package oapi

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
)

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
