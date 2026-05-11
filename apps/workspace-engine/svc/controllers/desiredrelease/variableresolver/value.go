package variableresolver

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/secrets"
	"workspace-engine/pkg/workspace/relationships"
)

// RelatedEntityResolver resolves a reference name to the matched related
// entities for a resource. Implementations may evaluate relationship rules
// in realtime or return pre-computed/mocked results.
type RelatedEntityResolver interface {
	ResolveRelated(ctx context.Context, reference string) ([]*oapi.RelatableEntity, error)
}

// SecretResolver fetches the plaintext value for a SecretReferenceValue.
// *secrets.Resolver satisfies this interface; tests use fakes.
type SecretResolver interface {
	Resolve(ctx context.Context, workspaceID uuid.UUID, ref secrets.SecretReference) (string, error)
}

// ResolveValue resolves a single oapi.Value to a concrete LiteralValue.
//
// Literal values are returned as-is. Reference values are resolved by
// finding related entities through the resolver and traversing the property
// path on the matched entity. Secret references are fetched through the
// SecretResolver and returned as string literals. Sensitive values without a
// concrete provider reference remain unresolvable.
//
// The boolean return is true when the resolved value originated from a
// secret_ref. Callers use it to populate release.EncryptedVariables so that
// downstream consumers can mark the value as sensitive in logs and UI.
func ResolveValue(
	ctx context.Context,
	resolver RelatedEntityResolver,
	secretResolver SecretResolver,
	workspaceID uuid.UUID,
	resourceID string,
	entity *oapi.RelatableEntity,
	value *oapi.Value,
) (*oapi.LiteralValue, bool, error) {
	ctx, span := tracer.Start(ctx, "variableresolver.ResolveValue")
	defer span.End()

	valueType, err := value.GetType()
	if err != nil {
		return nil, false, fmt.Errorf("determine value type: %w", err)
	}

	switch valueType {
	case "literal":
		lv, err := resolveLiteral(value)
		return lv, false, err
	case "reference":
		lv, err := resolveReference(ctx, resolver, value, entity)
		return lv, false, err
	case "secret_ref":
		lv, err := resolveSecretReference(ctx, secretResolver, workspaceID, value)
		return lv, err == nil, err
	case "sensitive":
		return nil, false, fmt.Errorf(
			"sensitive values are not resolved by the variable resolver",
		)
	default:
		return nil, false, fmt.Errorf("unsupported value type: %s", valueType)
	}
}

func resolveSecretReference(
	ctx context.Context,
	secretResolver SecretResolver,
	workspaceID uuid.UUID,
	value *oapi.Value,
) (*oapi.LiteralValue, error) {
	if secretResolver == nil {
		return nil, fmt.Errorf("secret_ref encountered but no SecretResolver configured")
	}
	srv, err := value.AsSecretReferenceValue()
	if err != nil {
		return nil, fmt.Errorf("extract secret reference value: %w", err)
	}
	ref := secrets.SecretReference{
		Provider: srv.SecretProvider,
		Key:      srv.SecretKey,
	}
	if srv.SecretPath != nil && len(*srv.SecretPath) > 0 {
		// Provider-specific path serialization: join with "/" so Doppler
		// (project/config) and AWS (secret name + optional segments) can
		// reuse the canonical Path field rather than carrying an array.
		ref.Path = (*srv.SecretPath)[0]
		for i := 1; i < len(*srv.SecretPath); i++ {
			ref.Path += "/" + (*srv.SecretPath)[i]
		}
	}
	plaintext, err := secretResolver.Resolve(ctx, workspaceID, ref)
	if err != nil {
		return nil, fmt.Errorf(
			"resolve secret %s/%s/%s: %w",
			ref.Provider,
			ref.Path,
			ref.Key,
			err,
		)
	}
	return oapi.NewLiteralValue(plaintext), nil
}

func resolveLiteral(value *oapi.Value) (*oapi.LiteralValue, error) {
	lv, err := value.AsLiteralValue()
	if err != nil {
		return nil, fmt.Errorf("extract literal value: %w", err)
	}
	return &lv, nil
}

func resolveReference(
	ctx context.Context,
	resolver RelatedEntityResolver,
	value *oapi.Value,
	entity *oapi.RelatableEntity,
) (*oapi.LiteralValue, error) {
	rv, err := value.AsReferenceValue()
	if err != nil {
		return nil, fmt.Errorf("extract reference value: %w", err)
	}

	refs, err := resolver.ResolveRelated(ctx, rv.Reference)
	if err != nil {
		return nil, fmt.Errorf("resolve related entities for reference %q: %w", rv.Reference, err)
	}
	if len(refs) == 0 {
		return nil, fmt.Errorf(
			"reference %q not found for entity %s-%s",
			rv.Reference, entity.GetType(), entity.GetID(),
		)
	}

	lv, err := relationships.GetPropertyValue(refs[0], rv.Path)
	if err != nil {
		return nil, fmt.Errorf(
			"resolve property path %v on reference %q: %w",
			rv.Path,
			rv.Reference,
			err,
		)
	}
	return lv, nil
}
