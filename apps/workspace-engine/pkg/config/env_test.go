package config

import (
	"runtime"
	"testing"
)

func TestGetMaxConcurrency(t *testing.T) {
	save := Global
	t.Cleanup(func() { Global = save })

	gomaxprocs := runtime.GOMAXPROCS(0)

	tests := []struct {
		name      string
		kind      string
		global    int
		overrides string
		want      int
	}{
		{
			name: "falls back to GOMAXPROCS when nothing set",
			kind: "policy-eval",
			want: gomaxprocs,
		},
		{
			name:   "uses global when set and no override",
			kind:   "policy-eval",
			global: 8,
			want:   8,
		},
		{
			name:      "per-service override takes precedence over global",
			kind:      "policy-eval",
			global:    8,
			overrides: "policy-eval=4",
			want:      4,
		},
		{
			name:      "unmatched kind falls back to global",
			kind:      "desired-release",
			global:    8,
			overrides: "policy-eval=4",
			want:      8,
		},
		{
			name:      "unmatched kind falls back to GOMAXPROCS when global is 0",
			kind:      "desired-release",
			overrides: "policy-eval=4",
			want:      gomaxprocs,
		},
		{
			name:      "multiple overrides parsed correctly",
			kind:      "job-dispatch",
			global:    8,
			overrides: "policy-eval=4,job-dispatch=16,desired-release=2",
			want:      16,
		},
		{
			name:      "whitespace in overrides is trimmed",
			kind:      "policy-eval",
			global:    8,
			overrides: " policy-eval = 12 , desired-release = 2 ",
			want:      12,
		},
		{
			name:      "invalid number falls back to global",
			kind:      "policy-eval",
			global:    8,
			overrides: "policy-eval=abc",
			want:      8,
		},
		{
			name:      "zero value override falls back to global",
			kind:      "policy-eval",
			global:    8,
			overrides: "policy-eval=0",
			want:      8,
		},
		{
			name:      "negative value override falls back to global",
			kind:      "policy-eval",
			global:    8,
			overrides: "policy-eval=-5",
			want:      8,
		},
		{
			name:      "entry without equals sign is skipped",
			kind:      "policy-eval",
			global:    8,
			overrides: "policy-eval",
			want:      8,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			Global.ReconcileMaxConcurrency = tt.global
			Global.ReconcileMaxConcurrencyOverrides = tt.overrides

			got := GetMaxConcurrency(tt.kind)
			if got != tt.want {
				t.Errorf("GetMaxConcurrency(%q) = %d, want %d", tt.kind, got, tt.want)
			}
		})
	}
}
