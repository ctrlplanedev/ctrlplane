package pb

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"time"
)

func (r *Release) ID() string {
	// Collect relevant fields for deterministic ID
	var sb strings.Builder
	if r.Version != nil {
		sb.WriteString(r.Version.Id)
		sb.WriteString(r.Version.Tag)
	}

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

	// Hash the concatenated string
	hash := sha256.Sum256([]byte(sb.String()))
	return hex.EncodeToString(hash[:])
}

func (r *Release) ResolvedVariables() map[string]any {
	copied := make(map[string]any, len(r.Variables))
	for k, v := range r.Variables {
		copied[k] = v
	}

	// Decrypt and add encrypted variables, if any
	// for _, k := range r.EncryptedVariables {
	// 	val := copied[k]
	// 	if _, ok := val.(string); ok {
	// 		// copied[k] = copied[k]
	// 	}
	// }

	return copied
}

func (r *Release) CreatedAtTime() (time.Time, error) {
	return time.Parse(time.RFC3339, r.CreatedAt)
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
