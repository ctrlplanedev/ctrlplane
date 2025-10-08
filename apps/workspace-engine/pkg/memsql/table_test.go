package memsql

import (
	"testing"
)

func TestTableBuilder_BasicTable(t *testing.T) {
	builder := NewTableBuilder("users").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT")

	expected := "CREATE TABLE users (id TEXT NOT NULL, name TEXT);"
	result := builder.Build()

	if result != expected {
		t.Errorf("Expected:\n%s\n\nGot:\n%s", expected, result)
	}
}

func TestTableBuilder_WithPrimaryKey(t *testing.T) {
	builder := NewTableBuilder("users").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("email", "TEXT").
		WithPrimaryKey("id")

	expected := "CREATE TABLE users (id TEXT NOT NULL, email TEXT, PRIMARY KEY (id));"
	result := builder.Build()

	if result != expected {
		t.Errorf("Expected:\n%s\n\nGot:\n%s", expected, result)
	}
}

func TestTableBuilder_WithCompositePrimaryKey(t *testing.T) {
	builder := NewTableBuilder("user_roles").
		WithColumn("user_id", "TEXT NOT NULL").
		WithColumn("role_id", "TEXT NOT NULL").
		WithColumn("granted_at", "INTEGER").
		WithPrimaryKey("user_id", "role_id")

	expected := "CREATE TABLE user_roles (user_id TEXT NOT NULL, role_id TEXT NOT NULL, granted_at INTEGER, PRIMARY KEY (user_id, role_id));"
	result := builder.Build()

	if result != expected {
		t.Errorf("Expected:\n%s\n\nGot:\n%s", expected, result)
	}
}

func TestTableBuilder_WithIndex(t *testing.T) {
	builder := NewTableBuilder("users").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("email", "TEXT").
		WithPrimaryKey("id").
		WithIndex("CREATE INDEX idx_users_email ON users(email)")

	expected := "CREATE TABLE users (id TEXT NOT NULL, email TEXT, PRIMARY KEY (id));\nCREATE INDEX idx_users_email ON users(email);"
	result := builder.Build()

	if result != expected {
		t.Errorf("Expected:\n%s\n\nGot:\n%s", expected, result)
	}
}

func TestTableBuilder_WithMultipleIndices(t *testing.T) {
	builder := NewTableBuilder("products").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("category", "TEXT").
		WithColumn("price", "REAL").
		WithPrimaryKey("id").
		WithIndex("CREATE INDEX idx_products_name ON products(name)").
		WithIndex("CREATE INDEX idx_products_category ON products(category)")

	expected := "CREATE TABLE products (id TEXT NOT NULL, name TEXT, category TEXT, price REAL, PRIMARY KEY (id));\nCREATE INDEX idx_products_name ON products(name);\nCREATE INDEX idx_products_category ON products(category);"
	result := builder.Build()

	if result != expected {
		t.Errorf("Expected:\n%s\n\nGot:\n%s", expected, result)
	}
}

func TestTableBuilder_ComplexTable(t *testing.T) {
	builder := NewTableBuilder("orders").
		WithColumn("order_id", "TEXT NOT NULL").
		WithColumn("user_id", "TEXT NOT NULL").
		WithColumn("product_id", "TEXT NOT NULL").
		WithColumn("quantity", "INTEGER").
		WithColumn("total_price", "REAL").
		WithColumn("created_at", "INTEGER").
		WithPrimaryKey("order_id").
		WithIndex("CREATE INDEX idx_orders_user_id ON orders(user_id)").
		WithIndex("CREATE INDEX idx_orders_created_at ON orders(created_at)")

	expected := "CREATE TABLE orders (order_id TEXT NOT NULL, user_id TEXT NOT NULL, product_id TEXT NOT NULL, quantity INTEGER, total_price REAL, created_at INTEGER, PRIMARY KEY (order_id));\nCREATE INDEX idx_orders_user_id ON orders(user_id);\nCREATE INDEX idx_orders_created_at ON orders(created_at);"
	result := builder.Build()

	if result != expected {
		t.Errorf("Expected:\n%s\n\nGot:\n%s", expected, result)
	}
}

func TestTableBuilder_TableWithoutPrimaryKey(t *testing.T) {
	builder := NewTableBuilder("logs").
		WithColumn("message", "TEXT").
		WithColumn("timestamp", "INTEGER")

	expected := "CREATE TABLE logs (message TEXT, timestamp INTEGER);"
	result := builder.Build()

	if result != expected {
		t.Errorf("Expected:\n%s\n\nGot:\n%s", expected, result)
	}
}

func TestTableBuilder_OnlyTableName(t *testing.T) {
	builder := NewTableBuilder("empty_table")

	expected := "CREATE TABLE empty_table ();"
	result := builder.Build()

	if result != expected {
		t.Errorf("Expected:\n%s\n\nGot:\n%s", expected, result)
	}
}

func TestTableBuilder_MethodChaining(t *testing.T) {
	// Test that method chaining works correctly
	result := NewTableBuilder("test").
		WithColumn("col1", "TEXT").
		WithColumn("col2", "INTEGER").
		WithPrimaryKey("col1").
		WithIndex("CREATE INDEX idx_test ON test(col2)").
		Build()

	expected := "CREATE TABLE test (col1 TEXT, col2 INTEGER, PRIMARY KEY (col1));\nCREATE INDEX idx_test ON test(col2);"

	if result != expected {
		t.Errorf("Expected:\n%s\n\nGot:\n%s", expected, result)
	}
}

func TestTableBuilder_MultipleColumnsVariousTypes(t *testing.T) {
	builder := NewTableBuilder("analytics").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("event_name", "TEXT").
		WithColumn("user_id", "TEXT").
		WithColumn("count", "INTEGER DEFAULT 0").
		WithColumn("percentage", "REAL").
		WithColumn("is_active", "BOOLEAN").
		WithColumn("data", "BLOB").
		WithColumn("created_at", "INTEGER NOT NULL").
		WithPrimaryKey("id")

	expected := "CREATE TABLE analytics (id TEXT NOT NULL, event_name TEXT, user_id TEXT, count INTEGER DEFAULT 0, percentage REAL, is_active BOOLEAN, data BLOB, created_at INTEGER NOT NULL, PRIMARY KEY (id));"
	result := builder.Build()

	if result != expected {
		t.Errorf("Expected:\n%s\n\nGot:\n%s", expected, result)
	}
}

func TestJoinComma(t *testing.T) {
	tests := []struct {
		name     string
		items    []string
		expected string
	}{
		{
			name:     "empty slice",
			items:    []string{},
			expected: "",
		},
		{
			name:     "single item",
			items:    []string{"item1"},
			expected: "item1",
		},
		{
			name:     "two items",
			items:    []string{"item1", "item2"},
			expected: "item1, item2",
		},
		{
			name:     "multiple items",
			items:    []string{"col1", "col2", "col3", "col4"},
			expected: "col1, col2, col3, col4",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := joinComma(tt.items)
			if result != tt.expected {
				t.Errorf("joinComma() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestJoinStatements(t *testing.T) {
	tests := []struct {
		name     string
		stmts    []string
		expected string
	}{
		{
			name:     "empty slice",
			stmts:    []string{},
			expected: "",
		},
		{
			name:     "single statement",
			stmts:    []string{"CREATE TABLE test (id TEXT)"},
			expected: "CREATE TABLE test (id TEXT);",
		},
		{
			name:     "two statements",
			stmts:    []string{"CREATE TABLE test (id TEXT)", "CREATE INDEX idx ON test(id)"},
			expected: "CREATE TABLE test (id TEXT);\nCREATE INDEX idx ON test(id);",
		},
		{
			name: "multiple statements",
			stmts: []string{
				"CREATE TABLE test (id TEXT)",
				"CREATE INDEX idx1 ON test(id)",
				"CREATE INDEX idx2 ON test(name)",
			},
			expected: "CREATE TABLE test (id TEXT);\nCREATE INDEX idx1 ON test(id);\nCREATE INDEX idx2 ON test(name);",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := joinStatements(tt.stmts)
			if result != tt.expected {
				t.Errorf("joinStatements() = %q, want %q", result, tt.expected)
			}
		})
	}
}
