package secrets

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/crypto"
	"workspace-engine/pkg/db"
)

// Decryptor decrypts the bytea config payload stored on secret_provider rows.
// Matched 1:1 with the AES-256-CBC implementation used by @ctrlplane/secrets
// on the TypeScript side.
type Decryptor interface {
	Decrypt(ciphertext string) (string, error)
}

// PostgresStore loads secret_provider rows via sqlc and decrypts their
// configs in memory.
type PostgresStore struct {
	queries   *db.Queries
	decryptor Decryptor
}

// NewPostgresStore constructs a store using a sqlc Queries handle and a
// crypto.AES256CBC built from the workspace-engine's VARIABLES_AES_256_KEY.
func NewPostgresStore(queries *db.Queries, decryptor Decryptor) *PostgresStore {
	return &PostgresStore{queries: queries, decryptor: decryptor}
}

// NewPostgresStoreFromKey is a convenience constructor for callers that have a
// hex key rather than a Decryptor instance.
func NewPostgresStoreFromKey(queries *db.Queries, keyHex string) (*PostgresStore, error) {
	dec, err := crypto.New(keyHex)
	if err != nil {
		return nil, fmt.Errorf("secrets: bad decryption key: %w", err)
	}
	return NewPostgresStore(queries, dec), nil
}

func (s *PostgresStore) Get(
	ctx context.Context,
	workspaceID uuid.UUID,
	providerName string,
) (*ProviderConfig, error) {
	row, err := s.queries.GetSecretProviderByName(ctx, db.GetSecretProviderByNameParams{
		WorkspaceID: workspaceID,
		Name:        providerName,
	})
	if err != nil {
		return nil, fmt.Errorf(
			"secrets: load provider %q for workspace %s: %w",
			providerName,
			workspaceID,
			err,
		)
	}
	return s.toProviderConfig(row)
}

func (s *PostgresStore) List(
	ctx context.Context,
	workspaceID uuid.UUID,
) ([]*ProviderConfig, error) {
	rows, err := s.queries.ListSecretProvidersByWorkspaceID(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("secrets: list providers for workspace %s: %w", workspaceID, err)
	}
	out := make([]*ProviderConfig, 0, len(rows))
	for _, row := range rows {
		cfg, err := s.toProviderConfig(row)
		if err != nil {
			return nil, err
		}
		out = append(out, cfg)
	}
	return out, nil
}

func (s *PostgresStore) toProviderConfig(row db.SecretProvider) (*ProviderConfig, error) {
	// Ciphertext is the TS-encoded string ("<iv-hex>:<ciphertext-hex>") stored
	// as bytea. Bytea -> []byte -> string with no transformation.
	plaintext, err := s.decryptor.Decrypt(string(row.Config))
	if err != nil {
		return nil, fmt.Errorf("secrets: decrypt config for %q: %w", row.Name, err)
	}
	cfg := make(map[string]any)
	if err := json.Unmarshal([]byte(plaintext), &cfg); err != nil {
		return nil, fmt.Errorf("secrets: parse decrypted config for %q: %w", row.Name, err)
	}
	return &ProviderConfig{
		ID:          row.ID,
		WorkspaceID: row.WorkspaceID,
		Name:        row.Name,
		Type:        string(row.Type),
		Config:      cfg,
	}, nil
}
