package providers

import (
	"sort"
	"testing"
)

func TestRegisterAllRegistersExpectedTypes(t *testing.T) {
	r := NewDefaultRegistry()
	got := r.Types()
	sort.Strings(got)
	want := []string{"aws_secrets_manager", "doppler", "env"}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i, w := range want {
		if got[i] != w {
			t.Fatalf("got %v, want %v", got, want)
		}
	}
}
