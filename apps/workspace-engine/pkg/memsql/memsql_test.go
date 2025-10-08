package memsql

import (
	"testing"

	"google.golang.org/protobuf/types/known/structpb"
)

type User struct {
	ID    string
	Name  string
	Email string
	Age   int
}

type Product struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Price    float64 `json:"price"`
	Category string  `json:"category"`
}

type Order struct {
	OrderID    string  `json:"order_id"`
	UserID     string  `json:"user_id"`
	TotalPrice float64 `json:"total_price"`
	Quantity   int     `json:"quantity"`
}

func TestMemSQL_Query_BasicSelect(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("email", "TEXT").
		WithColumn("age", "INTEGER").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert test data
	_, err := memSQL.DB().Exec(`
		INSERT INTO users (id, name, email, age) VALUES 
		('1', 'Alice', 'alice@example.com', 30),
		('2', 'Bob', 'bob@example.com', 25)
	`)
	if err != nil {
		t.Fatalf("Failed to insert test data: %v", err)
	}

	// Query all users
	users, err := memSQL.Query("SELECT * FROM users ORDER BY id")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(users) != 2 {
		t.Errorf("Expected 2 users, got %d", len(users))
	}

	if users[0].ID != "1" || users[0].Name != "Alice" || users[0].Email != "alice@example.com" || users[0].Age != 30 {
		t.Errorf("User 1 data mismatch: %+v", users[0])
	}

	if users[1].ID != "2" || users[1].Name != "Bob" || users[1].Email != "bob@example.com" || users[1].Age != 25 {
		t.Errorf("User 2 data mismatch: %+v", users[1])
	}
}

func TestMemSQL_Query_WithWhere(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("email", "TEXT").
		WithColumn("age", "INTEGER").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert test data
	memSQL.DB().Exec(`
		INSERT INTO users (id, name, email, age) VALUES 
		('1', 'Alice', 'alice@example.com', 30),
		('2', 'Bob', 'bob@example.com', 25),
		('3', 'Charlie', 'charlie@example.com', 35)
	`)

	// Query with WHERE clause
	users, err := memSQL.Query("SELECT * FROM users WHERE age > ? ORDER BY id", 26)
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(users) != 2 {
		t.Errorf("Expected 2 users with age > 26, got %d", len(users))
	}

	if users[0].Name != "Alice" || users[1].Name != "Charlie" {
		t.Errorf("Expected Alice and Charlie, got %s and %s", users[0].Name, users[1].Name)
	}
}

func TestMemSQL_Query_WithJSONTags(t *testing.T) {
	tableBuilder := NewTableBuilder("products").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("price", "REAL").
		WithColumn("category", "TEXT").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[Product](tableBuilder)

	// Insert test data
	memSQL.DB().Exec(`
		INSERT INTO products (id, name, price, category) VALUES 
		('p1', 'Laptop', 999.99, 'Electronics'),
		('p2', 'Mouse', 29.99, 'Electronics')
	`)

	// Query products
	products, err := memSQL.Query("SELECT * FROM products ORDER BY id")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(products) != 2 {
		t.Errorf("Expected 2 products, got %d", len(products))
	}

	if products[0].ID != "p1" || products[0].Name != "Laptop" || products[0].Price != 999.99 {
		t.Errorf("Product 1 data mismatch: %+v", products[0])
	}

	if products[1].Category != "Electronics" {
		t.Errorf("Expected category Electronics, got %s", products[1].Category)
	}
}

func TestMemSQL_Query_EmptyResult(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("email", "TEXT").
		WithColumn("age", "INTEGER").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[User](tableBuilder)

	// Query empty table
	users, err := memSQL.Query("SELECT * FROM users")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(users) != 0 {
		t.Errorf("Expected 0 users, got %d", len(users))
	}
}

func TestMemSQL_QueryOne_Success(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("email", "TEXT").
		WithColumn("age", "INTEGER").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert test data
	memSQL.DB().Exec(`
		INSERT INTO users (id, name, email, age) VALUES 
		('1', 'Alice', 'alice@example.com', 30)
	`)

	// Query single user
	user, err := memSQL.QueryOne("SELECT * FROM users WHERE id = ?", "1")
	if err != nil {
		t.Fatalf("QueryOne failed: %v", err)
	}

	if user.ID != "1" || user.Name != "Alice" {
		t.Errorf("User data mismatch: %+v", user)
	}
}

func TestMemSQL_QueryOne_NoRows(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("email", "TEXT").
		WithColumn("age", "INTEGER").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[User](tableBuilder)

	// Query non-existent user
	_, err := memSQL.QueryOne("SELECT * FROM users WHERE id = ?", "999")
	if err == nil {
		t.Fatal("Expected error for no rows, got nil")
	}
}

func TestMemSQL_QueryOne_MultipleRows(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("email", "TEXT").
		WithColumn("age", "INTEGER").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert multiple users
	memSQL.DB().Exec(`
		INSERT INTO users (id, name, email, age) VALUES 
		('1', 'Alice', 'alice@example.com', 30),
		('2', 'Bob', 'bob@example.com', 25)
	`)

	// Query without WHERE clause (will return multiple rows)
	_, err := memSQL.QueryOne("SELECT * FROM users")
	if err == nil {
		t.Fatal("Expected error for multiple rows, got nil")
	}
}

func TestMemSQL_Query_SelectSpecificColumns(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("email", "TEXT").
		WithColumn("age", "INTEGER").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert test data
	memSQL.DB().Exec(`
		INSERT INTO users (id, name, email, age) VALUES 
		('1', 'Alice', 'alice@example.com', 30)
	`)

	// Query only specific columns
	users, err := memSQL.Query("SELECT id, name FROM users")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(users) != 1 {
		t.Fatalf("Expected 1 user, got %d", len(users))
	}

	// ID and Name should be populated
	if users[0].ID != "1" || users[0].Name != "Alice" {
		t.Errorf("User data mismatch: %+v", users[0])
	}

	// Email and Age should be zero values
	if users[0].Email != "" || users[0].Age != 0 {
		t.Errorf("Expected zero values for unselected fields, got email=%s, age=%d", users[0].Email, users[0].Age)
	}
}

func TestMemSQL_Query_ComplexStruct(t *testing.T) {
	tableBuilder := NewTableBuilder("orders").
		WithColumn("order_id", "TEXT NOT NULL").
		WithColumn("user_id", "TEXT NOT NULL").
		WithColumn("total_price", "REAL").
		WithColumn("quantity", "INTEGER").
		WithPrimaryKey("order_id")

	memSQL := NewMemSQL[Order](tableBuilder)

	// Insert test data
	memSQL.DB().Exec(`
		INSERT INTO orders (order_id, user_id, total_price, quantity) VALUES 
		('o1', 'u1', 99.99, 2),
		('o2', 'u2', 149.99, 3)
	`)

	// Query orders
	orders, err := memSQL.Query("SELECT * FROM orders ORDER BY order_id")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(orders) != 2 {
		t.Errorf("Expected 2 orders, got %d", len(orders))
	}

	if orders[0].OrderID != "o1" || orders[0].UserID != "u1" || orders[0].TotalPrice != 99.99 || orders[0].Quantity != 2 {
		t.Errorf("Order 1 data mismatch: %+v", orders[0])
	}

	if orders[1].OrderID != "o2" || orders[1].UserID != "u2" || orders[1].TotalPrice != 149.99 || orders[1].Quantity != 3 {
		t.Errorf("Order 2 data mismatch: %+v", orders[1])
	}
}

func TestMemSQL_Query_CaseInsensitiveMatching(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("NAME", "TEXT").
		WithColumn("EMAIL", "TEXT").
		WithColumn("AGE", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert test data with uppercase column names
	memSQL.DB().Exec(`
		INSERT INTO users (ID, NAME, EMAIL, AGE) VALUES 
		('1', 'Alice', 'alice@example.com', 30)
	`)

	// Query should still work despite case differences
	users, err := memSQL.Query("SELECT * FROM users")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(users) != 1 {
		t.Fatalf("Expected 1 user, got %d", len(users))
	}

	if users[0].ID != "1" || users[0].Name != "Alice" {
		t.Errorf("User data mismatch: %+v", users[0])
	}
}

func TestMemSQL_Query_JSONTagsWithOmitempty(t *testing.T) {
	type UserWithTags struct {
		ID    string `json:"user_id,omitempty"`
		Name  string `json:"full_name,omitempty"`
		Email string `json:"email_address,omitempty"`
	}

	tableBuilder := NewTableBuilder("users").
		WithColumn("user_id", "TEXT NOT NULL").
		WithColumn("full_name", "TEXT").
		WithColumn("email_address", "TEXT").
		WithPrimaryKey("user_id")

	memSQL := NewMemSQL[UserWithTags](tableBuilder)

	// Insert test data
	memSQL.DB().Exec(`
		INSERT INTO users (user_id, full_name, email_address) VALUES 
		('u1', 'Alice Smith', 'alice@example.com')
	`)

	// Query should correctly map json tags (ignoring omitempty)
	users, err := memSQL.Query("SELECT * FROM users")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(users) != 1 {
		t.Fatalf("Expected 1 user, got %d", len(users))
	}

	if users[0].ID != "u1" || users[0].Name != "Alice Smith" || users[0].Email != "alice@example.com" {
		t.Errorf("User data mismatch: %+v", users[0])
	}
}

func TestMemSQL_Insert_BasicInsert(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert a user
	user := User{
		ID:    "1",
		Name:  "Alice",
		Email: "alice@example.com",
		Age:   30,
	}

	err := memSQL.Insert(user)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	// Verify the insert
	users, err := memSQL.Query("SELECT * FROM users WHERE ID = ?", "1")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(users) != 1 {
		t.Fatalf("Expected 1 user, got %d", len(users))
	}

	if users[0].ID != "1" || users[0].Name != "Alice" || users[0].Email != "alice@example.com" || users[0].Age != 30 {
		t.Errorf("User data mismatch: %+v", users[0])
	}
}

func TestMemSQL_Insert_WithJSONTags(t *testing.T) {
	tableBuilder := NewTableBuilder("orders").
		WithColumn("order_id", "TEXT NOT NULL").
		WithColumn("user_id", "TEXT NOT NULL").
		WithColumn("total_price", "REAL").
		WithColumn("quantity", "INTEGER").
		WithPrimaryKey("order_id")

	memSQL := NewMemSQL[Order](tableBuilder)

	// Insert an order
	order := Order{
		OrderID:    "o1",
		UserID:     "u1",
		TotalPrice: 99.99,
		Quantity:   2,
	}

	err := memSQL.Insert(order)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	// Verify the insert
	orders, err := memSQL.Query("SELECT * FROM orders WHERE order_id = ?", "o1")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(orders) != 1 {
		t.Fatalf("Expected 1 order, got %d", len(orders))
	}

	if orders[0].OrderID != "o1" || orders[0].UserID != "u1" || orders[0].TotalPrice != 99.99 || orders[0].Quantity != 2 {
		t.Errorf("Order data mismatch: %+v", orders[0])
	}
}

func TestMemSQL_InsertMany_MultipleRecords(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert multiple users
	users := []User{
		{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30},
		{ID: "2", Name: "Bob", Email: "bob@example.com", Age: 25},
		{ID: "3", Name: "Charlie", Email: "charlie@example.com", Age: 35},
	}

	err := memSQL.InsertMany(users)
	if err != nil {
		t.Fatalf("InsertMany failed: %v", err)
	}

	// Verify all inserts
	result, err := memSQL.Query("SELECT * FROM users ORDER BY ID")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(result) != 3 {
		t.Fatalf("Expected 3 users, got %d", len(result))
	}

	if result[0].Name != "Alice" || result[1].Name != "Bob" || result[2].Name != "Charlie" {
		t.Errorf("Users not inserted correctly: %+v", result)
	}
}

func TestMemSQL_InsertMany_EmptySlice(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert empty slice should not error
	err := memSQL.InsertMany([]User{})
	if err != nil {
		t.Fatalf("InsertMany with empty slice failed: %v", err)
	}

	// Verify no records inserted
	result, err := memSQL.Query("SELECT * FROM users")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(result) != 0 {
		t.Errorf("Expected 0 users, got %d", len(result))
	}
}

func TestMemSQL_InsertMany_WithJSONTags(t *testing.T) {
	tableBuilder := NewTableBuilder("products").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("price", "REAL").
		WithColumn("category", "TEXT").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[Product](tableBuilder)

	// Insert multiple products
	products := []Product{
		{ID: "p1", Name: "Laptop", Price: 999.99, Category: "Electronics"},
		{ID: "p2", Name: "Mouse", Price: 29.99, Category: "Electronics"},
		{ID: "p3", Name: "Desk", Price: 299.99, Category: "Furniture"},
	}

	err := memSQL.InsertMany(products)
	if err != nil {
		t.Fatalf("InsertMany failed: %v", err)
	}

	// Verify all inserts
	result, err := memSQL.Query("SELECT * FROM products ORDER BY id")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(result) != 3 {
		t.Fatalf("Expected 3 products, got %d", len(result))
	}

	if result[0].Name != "Laptop" || result[1].Name != "Mouse" || result[2].Name != "Desk" {
		t.Errorf("Products not inserted correctly: %+v", result)
	}
}

func TestMemSQL_Insert_ThenQuery(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert users using Insert
	memSQL.Insert(User{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30})
	memSQL.Insert(User{ID: "2", Name: "Bob", Email: "bob@example.com", Age: 25})

	// Query them back
	users, err := memSQL.Query("SELECT * FROM users WHERE Age > ? ORDER BY ID", 20)
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(users) != 2 {
		t.Fatalf("Expected 2 users, got %d", len(users))
	}

	// Use QueryOne
	user, err := memSQL.QueryOne("SELECT * FROM users WHERE ID = ?", "1")
	if err != nil {
		t.Fatalf("QueryOne failed: %v", err)
	}

	if user.Name != "Alice" {
		t.Errorf("Expected Alice, got %s", user.Name)
	}
}

func TestMemSQL_Timestamp_Insert(t *testing.T) {
	type Event struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		CreatedAt string `json:"created_at"`
	}

	tableBuilder := NewTableBuilder("events").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("created_at", "INTEGER").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[Event](tableBuilder)

	// Insert event with RFC3339 timestamp
	event := Event{
		ID:        "e1",
		Name:      "User Login",
		CreatedAt: "2024-01-15T10:30:00Z",
	}

	err := memSQL.Insert(event)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	// Query back to verify timestamp conversion
	events, err := memSQL.Query("SELECT * FROM events WHERE id = ?", "e1")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(events) != 1 {
		t.Fatalf("Expected 1 event, got %d", len(events))
	}

	// Verify timestamp is still a valid time string
	if events[0].CreatedAt == "" {
		t.Error("CreatedAt should not be empty")
	}

	// Verify the database stored it as an integer
	var dbValue any
	err = memSQL.DB().QueryRow("SELECT created_at FROM events WHERE id = ?", "e1").Scan(&dbValue)
	if err != nil {
		t.Fatalf("Failed to query raw value: %v", err)
	}

	if _, ok := dbValue.(int64); !ok {
		t.Errorf("Expected created_at to be stored as int64, got %T", dbValue)
	}
}

func TestMemSQL_Timestamp_InsertMany(t *testing.T) {
	type Event struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
	}

	tableBuilder := NewTableBuilder("events").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("created_at", "INTEGER").
		WithColumn("updated_at", "INTEGER").
		WithPrimaryKey("id").
		WithIndex("CREATE INDEX idx_created_at ON events(created_at)")

	memSQL := NewMemSQL[Event](tableBuilder)

	// Insert multiple events with timestamps
	events := []Event{
		{ID: "e1", Name: "Event 1", CreatedAt: "2024-01-15T10:00:00Z", UpdatedAt: "2024-01-15T10:00:00Z"},
		{ID: "e2", Name: "Event 2", CreatedAt: "2024-01-15T11:00:00Z", UpdatedAt: "2024-01-15T11:00:00Z"},
		{ID: "e3", Name: "Event 3", CreatedAt: "2024-01-15T12:00:00Z", UpdatedAt: "2024-01-15T12:00:00Z"},
	}

	err := memSQL.InsertMany(events)
	if err != nil {
		t.Fatalf("InsertMany failed: %v", err)
	}

	// Query all events
	result, err := memSQL.Query("SELECT * FROM events ORDER BY id")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(result) != 3 {
		t.Fatalf("Expected 3 events, got %d", len(result))
	}

	// Verify all have timestamps
	for i, event := range result {
		if event.CreatedAt == "" {
			t.Errorf("Event %d has empty CreatedAt", i)
		}
		if event.UpdatedAt == "" {
			t.Errorf("Event %d has empty UpdatedAt", i)
		}
	}
}

func TestMemSQL_Timestamp_RangeQuery(t *testing.T) {
	type Event struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		CreatedAt string `json:"created_at"`
	}

	tableBuilder := NewTableBuilder("events").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("created_at", "INTEGER").
		WithPrimaryKey("id").
		WithIndex("CREATE INDEX idx_created_at ON events(created_at)")

	memSQL := NewMemSQL[Event](tableBuilder)

	// Insert events with different timestamps
	events := []Event{
		{ID: "e1", Name: "Event 1", CreatedAt: "2024-01-01T10:00:00Z"},
		{ID: "e2", Name: "Event 2", CreatedAt: "2024-01-15T10:00:00Z"},
		{ID: "e3", Name: "Event 3", CreatedAt: "2024-02-01T10:00:00Z"},
		{ID: "e4", Name: "Event 4", CreatedAt: "2024-03-01T10:00:00Z"},
	}

	memSQL.InsertMany(events)

	// Query for events created after Jan 10, 2024
	// Since timestamps are stored as integers, we can use direct comparison
	afterDate := int64(1705748400) // Jan 20, 2024 in Unix timestamp

	result, err := memSQL.Query("SELECT * FROM events WHERE created_at > ? ORDER BY created_at", afterDate)
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(result) != 2 {
		t.Fatalf("Expected 2 events after Jan 20, got %d", len(result))
	}

	if result[0].Name != "Event 3" || result[1].Name != "Event 4" {
		t.Errorf("Expected Event 3 and Event 4, got %s and %s", result[0].Name, result[1].Name)
	}
}

func TestMemSQL_Timestamp_VariousFormats(t *testing.T) {
	type Event struct {
		ID        string `json:"id"`
		Timestamp string `json:"timestamp"`
	}

	tableBuilder := NewTableBuilder("events").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("timestamp", "INTEGER").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[Event](tableBuilder)

	// Test various timestamp formats
	testCases := []struct {
		id        string
		timestamp string
	}{
		{"e1", "2024-01-15T10:30:00Z"},
		{"e2", "2024-01-15T10:30:00"},
		{"e3", "2024-01-15 10:30:00"},
		{"e4", "2024-01-15"},
	}

	for _, tc := range testCases {
		event := Event{ID: tc.id, Timestamp: tc.timestamp}
		err := memSQL.Insert(event)
		if err != nil {
			t.Errorf("Failed to insert event with timestamp %s: %v", tc.timestamp, err)
		}
	}

	// Query all and verify they were stored
	events, err := memSQL.Query("SELECT * FROM events ORDER BY id")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(events) != len(testCases) {
		t.Fatalf("Expected %d events, got %d", len(testCases), len(events))
	}

	for i, event := range events {
		if event.Timestamp == "" {
			t.Errorf("Event %d has empty timestamp", i)
		}
	}
}

func TestMemSQL_Timestamp_EmptyValue(t *testing.T) {
	type Event struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		CreatedAt string `json:"created_at"`
	}

	tableBuilder := NewTableBuilder("events").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("created_at", "INTEGER").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[Event](tableBuilder)

	// Insert event with empty timestamp
	event := Event{
		ID:        "e1",
		Name:      "Event without timestamp",
		CreatedAt: "",
	}

	err := memSQL.Insert(event)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	// Query back
	events, err := memSQL.Query("SELECT * FROM events WHERE id = ?", "e1")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(events) != 1 {
		t.Fatalf("Expected 1 event, got %d", len(events))
	}

	// Empty timestamp should remain empty
	if events[0].CreatedAt != "" {
		t.Errorf("Expected empty CreatedAt, got %s", events[0].CreatedAt)
	}
}

func TestMemSQL_Delete_SingleRecord(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert test data
	memSQL.InsertMany([]User{
		{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30},
		{ID: "2", Name: "Bob", Email: "bob@example.com", Age: 25},
		{ID: "3", Name: "Charlie", Email: "charlie@example.com", Age: 35},
	})

	// Delete one user
	rowsAffected, err := memSQL.Delete("ID = ?", "2")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	if rowsAffected != 1 {
		t.Errorf("Expected 1 row affected, got %d", rowsAffected)
	}

	// Verify user is deleted
	users, _ := memSQL.Query("SELECT * FROM users ORDER BY ID")
	if len(users) != 2 {
		t.Errorf("Expected 2 users remaining, got %d", len(users))
	}

	if users[0].ID != "1" || users[1].ID != "3" {
		t.Errorf("Wrong users remaining: %+v", users)
	}
}

func TestMemSQL_Delete_MultipleRecords(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert test data
	memSQL.InsertMany([]User{
		{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30},
		{ID: "2", Name: "Bob", Email: "bob@example.com", Age: 25},
		{ID: "3", Name: "Charlie", Email: "charlie@example.com", Age: 35},
		{ID: "4", Name: "David", Email: "david@example.com", Age: 40},
	})

	// Delete users over 30
	rowsAffected, err := memSQL.Delete("Age > ?", 30)
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	if rowsAffected != 2 {
		t.Errorf("Expected 2 rows affected, got %d", rowsAffected)
	}

	// Verify correct users remain
	users, _ := memSQL.Query("SELECT * FROM users ORDER BY ID")
	if len(users) != 2 {
		t.Errorf("Expected 2 users remaining, got %d", len(users))
	}

	if users[0].Name != "Alice" || users[1].Name != "Bob" {
		t.Errorf("Wrong users remaining: %+v", users)
	}
}

func TestMemSQL_Delete_NoMatches(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert test data
	memSQL.Insert(User{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30})

	// Try to delete non-existent user
	rowsAffected, err := memSQL.Delete("ID = ?", "999")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	if rowsAffected != 0 {
		t.Errorf("Expected 0 rows affected, got %d", rowsAffected)
	}

	// Verify user still exists
	users, _ := memSQL.Query("SELECT * FROM users")
	if len(users) != 1 {
		t.Errorf("Expected 1 user remaining, got %d", len(users))
	}
}

func TestMemSQL_Delete_EmptyWhereClause(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Try to delete with empty WHERE clause
	_, err := memSQL.Delete("", "")
	if err == nil {
		t.Fatal("Expected error for empty WHERE clause, got nil")
	}
}

func TestMemSQL_Delete_All(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert test data
	memSQL.InsertMany([]User{
		{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30},
		{ID: "2", Name: "Bob", Email: "bob@example.com", Age: 25},
		{ID: "3", Name: "Charlie", Email: "charlie@example.com", Age: 35},
	})

	// Delete all users
	rowsAffected, err := memSQL.Delete("1=1")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	if rowsAffected != 3 {
		t.Errorf("Expected 3 rows affected, got %d", rowsAffected)
	}

	// Verify table is empty
	users, _ := memSQL.Query("SELECT * FROM users")
	if len(users) != 0 {
		t.Errorf("Expected 0 users remaining, got %d", len(users))
	}
}

func TestMemSQL_DeleteOne_Success(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert test data
	memSQL.InsertMany([]User{
		{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30},
		{ID: "2", Name: "Bob", Email: "bob@example.com", Age: 25},
	})

	// Delete one specific user
	err := memSQL.DeleteOne("ID = ?", "1")
	if err != nil {
		t.Fatalf("DeleteOne failed: %v", err)
	}

	// Verify user is deleted
	users, _ := memSQL.Query("SELECT * FROM users")
	if len(users) != 1 {
		t.Errorf("Expected 1 user remaining, got %d", len(users))
	}

	if users[0].ID != "2" {
		t.Errorf("Expected user 2 to remain, got %s", users[0].ID)
	}
}

func TestMemSQL_DeleteOne_NoRows(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert test data
	memSQL.Insert(User{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30})

	// Try to delete non-existent user
	err := memSQL.DeleteOne("ID = ?", "999")
	if err == nil {
		t.Fatal("Expected error for no rows, got nil")
	}
}

func TestMemSQL_DeleteOne_MultipleRows(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert test data
	memSQL.InsertMany([]User{
		{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30},
		{ID: "2", Name: "Bob", Email: "bob@example.com", Age: 30},
	})

	// Try to delete multiple users with same age
	err := memSQL.DeleteOne("Age = ?", 30)
	if err == nil {
		t.Fatal("Expected error for multiple rows, got nil")
	}

	// Verify no users were deleted
	users, _ := memSQL.Query("SELECT * FROM users")
	if len(users) != 2 {
		t.Errorf("Expected 2 users remaining, got %d", len(users))
	}
}

func TestMemSQL_DeleteOne_EmptyWhereClause(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Try to delete with empty WHERE clause
	err := memSQL.DeleteOne("")
	if err == nil {
		t.Fatal("Expected error for empty WHERE clause, got nil")
	}
}

func TestMemSQL_Delete_WithJSONTags(t *testing.T) {
	tableBuilder := NewTableBuilder("orders").
		WithColumn("order_id", "TEXT NOT NULL").
		WithColumn("user_id", "TEXT NOT NULL").
		WithColumn("total_price", "REAL").
		WithColumn("quantity", "INTEGER").
		WithPrimaryKey("order_id")

	memSQL := NewMemSQL[Order](tableBuilder)

	// Insert test data
	memSQL.InsertMany([]Order{
		{OrderID: "o1", UserID: "u1", TotalPrice: 99.99, Quantity: 2},
		{OrderID: "o2", UserID: "u2", TotalPrice: 149.99, Quantity: 3},
		{OrderID: "o3", UserID: "u1", TotalPrice: 79.99, Quantity: 1},
	})

	// Delete orders for user u1
	rowsAffected, err := memSQL.Delete("user_id = ?", "u1")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	if rowsAffected != 2 {
		t.Errorf("Expected 2 rows affected, got %d", rowsAffected)
	}

	// Verify only u2's order remains
	orders, _ := memSQL.Query("SELECT * FROM orders")
	if len(orders) != 1 {
		t.Errorf("Expected 1 order remaining, got %d", len(orders))
	}

	if orders[0].UserID != "u2" {
		t.Errorf("Expected order for u2, got %s", orders[0].UserID)
	}
}

func TestMemSQL_CRUD_Integration(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Create
	memSQL.InsertMany([]User{
		{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30},
		{ID: "2", Name: "Bob", Email: "bob@example.com", Age: 25},
		{ID: "3", Name: "Charlie", Email: "charlie@example.com", Age: 35},
	})

	// Read
	users, err := memSQL.Query("SELECT * FROM users ORDER BY ID")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}
	if len(users) != 3 {
		t.Fatalf("Expected 3 users, got %d", len(users))
	}

	// Update (via delete and re-insert)
	memSQL.DeleteOne("ID = ?", "2")
	memSQL.Insert(User{ID: "2", Name: "Bob Updated", Email: "bob.new@example.com", Age: 26})

	user, err := memSQL.QueryOne("SELECT * FROM users WHERE ID = ?", "2")
	if err != nil {
		t.Fatalf("QueryOne failed: %v", err)
	}
	if user.Name != "Bob Updated" || user.Age != 26 {
		t.Errorf("User not updated correctly: %+v", user)
	}

	// Delete
	memSQL.Delete("Age < ?", 30)

	remainingUsers, _ := memSQL.Query("SELECT * FROM users ORDER BY ID")
	if len(remainingUsers) != 2 {
		t.Errorf("Expected 2 users after delete, got %d", len(remainingUsers))
	}

	if remainingUsers[0].Name != "Alice" || remainingUsers[1].Name != "Charlie" {
		t.Errorf("Wrong users remaining: %+v", remainingUsers)
	}
}

func TestMemSQL_Delete_WithTimestamp(t *testing.T) {
	type Event struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		CreatedAt string `json:"created_at"`
	}

	tableBuilder := NewTableBuilder("events").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("created_at", "INTEGER").
		WithPrimaryKey("id").
		WithIndex("CREATE INDEX idx_created_at ON events(created_at)")

	memSQL := NewMemSQL[Event](tableBuilder)

	// Insert events with timestamps
	memSQL.InsertMany([]Event{
		{ID: "e1", Name: "Event 1", CreatedAt: "2024-01-01T10:00:00Z"},
		{ID: "e2", Name: "Event 2", CreatedAt: "2024-01-15T10:00:00Z"},
		{ID: "e3", Name: "Event 3", CreatedAt: "2024-02-01T10:00:00Z"},
		{ID: "e4", Name: "Event 4", CreatedAt: "2024-03-01T10:00:00Z"},
	})

	// Delete old events (before Jan 20, 2024)
	afterDate := int64(1705748400) // Jan 20, 2024 in Unix timestamp
	rowsAffected, err := memSQL.Delete("created_at < ?", afterDate)
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	if rowsAffected != 2 {
		t.Errorf("Expected 2 rows affected, got %d", rowsAffected)
	}

	// Verify only recent events remain
	events, _ := memSQL.Query("SELECT * FROM events ORDER BY id")
	if len(events) != 2 {
		t.Errorf("Expected 2 events remaining, got %d", len(events))
	}

	if events[0].Name != "Event 3" || events[1].Name != "Event 4" {
		t.Errorf("Wrong events remaining: %+v", events)
	}
}

func TestMemSQL_StructPB_Insert(t *testing.T) {
	type JobAgent struct {
		ID     string           `json:"id"`
		Name   string           `json:"name"`
		Config *structpb.Struct `json:"config"`
	}

	tableBuilder := NewTableBuilder("job_agents").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("config", "TEXT").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[JobAgent](tableBuilder)

	// Create a config struct
	config, err := structpb.NewStruct(map[string]interface{}{
		"api_key":    "secret123",
		"timeout":    30,
		"retry":      true,
		"namespaces": []interface{}{"default", "production"},
	})
	if err != nil {
		t.Fatalf("Failed to create structpb: %v", err)
	}

	// Insert job agent with config
	agent := JobAgent{
		ID:     "agent1",
		Name:   "Kubernetes Agent",
		Config: config,
	}

	err = memSQL.Insert(agent)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	// Query back
	agents, err := memSQL.Query("SELECT * FROM job_agents WHERE id = ?", "agent1")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(agents) != 1 {
		t.Fatalf("Expected 1 agent, got %d", len(agents))
	}

	// Verify basic fields
	if agents[0].ID != "agent1" || agents[0].Name != "Kubernetes Agent" {
		t.Errorf("Agent data mismatch: %+v", agents[0])
	}

	// Verify config was deserialized
	if agents[0].Config == nil {
		t.Fatal("Config should not be nil")
	}

	fields := agents[0].Config.Fields
	if fields["api_key"].GetStringValue() != "secret123" {
		t.Errorf("Expected api_key=secret123, got %s", fields["api_key"].GetStringValue())
	}

	if fields["timeout"].GetNumberValue() != 30 {
		t.Errorf("Expected timeout=30, got %f", fields["timeout"].GetNumberValue())
	}

	if fields["retry"].GetBoolValue() != true {
		t.Errorf("Expected retry=true, got %v", fields["retry"].GetBoolValue())
	}
}

func TestMemSQL_StructPB_InsertNil(t *testing.T) {
	type JobAgent struct {
		ID     string           `json:"id"`
		Name   string           `json:"name"`
		Config *structpb.Struct `json:"config"`
	}

	tableBuilder := NewTableBuilder("job_agents").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("config", "TEXT").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[JobAgent](tableBuilder)

	// Insert job agent with nil config
	agent := JobAgent{
		ID:     "agent1",
		Name:   "Simple Agent",
		Config: nil,
	}

	err := memSQL.Insert(agent)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	// Query back
	agents, err := memSQL.Query("SELECT * FROM job_agents WHERE id = ?", "agent1")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(agents) != 1 {
		t.Fatalf("Expected 1 agent, got %d", len(agents))
	}

	// Verify config is nil
	if agents[0].Config != nil {
		t.Errorf("Expected nil config, got %+v", agents[0].Config)
	}
}

func TestMemSQL_StructPB_InsertMany(t *testing.T) {
	type JobAgent struct {
		ID     string           `json:"id"`
		Name   string           `json:"name"`
		Config *structpb.Struct `json:"config"`
	}

	tableBuilder := NewTableBuilder("job_agents").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("config", "TEXT").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[JobAgent](tableBuilder)

	// Create configs
	config1, _ := structpb.NewStruct(map[string]interface{}{
		"type": "kubernetes",
		"port": 8080,
	})

	config2, _ := structpb.NewStruct(map[string]interface{}{
		"type": "docker",
		"port": 2375,
	})

	// Insert multiple agents
	agents := []JobAgent{
		{ID: "agent1", Name: "K8s Agent", Config: config1},
		{ID: "agent2", Name: "Docker Agent", Config: config2},
		{ID: "agent3", Name: "Simple Agent", Config: nil},
	}

	err := memSQL.InsertMany(agents)
	if err != nil {
		t.Fatalf("InsertMany failed: %v", err)
	}

	// Query all
	result, err := memSQL.Query("SELECT * FROM job_agents ORDER BY id")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(result) != 3 {
		t.Fatalf("Expected 3 agents, got %d", len(result))
	}

	// Verify first agent has kubernetes config
	if result[0].Config == nil {
		t.Fatal("Agent 1 config should not be nil")
	}
	if result[0].Config.Fields["type"].GetStringValue() != "kubernetes" {
		t.Errorf("Expected type=kubernetes, got %s", result[0].Config.Fields["type"].GetStringValue())
	}

	// Verify second agent has docker config
	if result[1].Config == nil {
		t.Fatal("Agent 2 config should not be nil")
	}
	if result[1].Config.Fields["type"].GetStringValue() != "docker" {
		t.Errorf("Expected type=docker, got %s", result[1].Config.Fields["type"].GetStringValue())
	}

	// Verify third agent has nil config
	if result[2].Config != nil {
		t.Errorf("Agent 3 config should be nil, got %+v", result[2].Config)
	}
}

func TestMemSQL_StructPB_ComplexNested(t *testing.T) {
	type Deployment struct {
		ID       string           `json:"id"`
		Name     string           `json:"name"`
		Metadata *structpb.Struct `json:"metadata"`
	}

	tableBuilder := NewTableBuilder("deployments").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("metadata", "TEXT").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[Deployment](tableBuilder)

	// Create complex nested structure
	metadata, err := structpb.NewStruct(map[string]interface{}{
		"version": "1.2.3",
		"labels": map[string]interface{}{
			"app":  "web",
			"tier": "frontend",
		},
		"resources": map[string]interface{}{
			"limits": map[string]interface{}{
				"cpu":    "500m",
				"memory": "512Mi",
			},
			"requests": map[string]interface{}{
				"cpu":    "250m",
				"memory": "256Mi",
			},
		},
		"replicas": 3,
		"enabled":  true,
	})
	if err != nil {
		t.Fatalf("Failed to create structpb: %v", err)
	}

	// Insert deployment
	deployment := Deployment{
		ID:       "deploy1",
		Name:     "Web App",
		Metadata: metadata,
	}

	err = memSQL.Insert(deployment)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	// Query back
	deployments, err := memSQL.Query("SELECT * FROM deployments WHERE id = ?", "deploy1")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(deployments) != 1 {
		t.Fatalf("Expected 1 deployment, got %d", len(deployments))
	}

	// Verify nested structure
	meta := deployments[0].Metadata
	if meta == nil {
		t.Fatal("Metadata should not be nil")
	}

	// Check version
	if meta.Fields["version"].GetStringValue() != "1.2.3" {
		t.Errorf("Expected version=1.2.3, got %s", meta.Fields["version"].GetStringValue())
	}

	// Check nested labels
	labels := meta.Fields["labels"].GetStructValue()
	if labels.Fields["app"].GetStringValue() != "web" {
		t.Errorf("Expected app=web, got %s", labels.Fields["app"].GetStringValue())
	}

	// Check deeply nested resources
	resources := meta.Fields["resources"].GetStructValue()
	limits := resources.Fields["limits"].GetStructValue()
	if limits.Fields["cpu"].GetStringValue() != "500m" {
		t.Errorf("Expected cpu=500m, got %s", limits.Fields["cpu"].GetStringValue())
	}

	// Check numbers and booleans
	if meta.Fields["replicas"].GetNumberValue() != 3 {
		t.Errorf("Expected replicas=3, got %f", meta.Fields["replicas"].GetNumberValue())
	}
	if meta.Fields["enabled"].GetBoolValue() != true {
		t.Errorf("Expected enabled=true, got %v", meta.Fields["enabled"].GetBoolValue())
	}
}

func TestMemSQL_StructPB_Update(t *testing.T) {
	type JobAgent struct {
		ID     string           `json:"id"`
		Name   string           `json:"name"`
		Config *structpb.Struct `json:"config"`
	}

	tableBuilder := NewTableBuilder("job_agents").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("config", "TEXT").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[JobAgent](tableBuilder)

	// Insert initial config
	config1, _ := structpb.NewStruct(map[string]interface{}{
		"version": "1.0.0",
		"enabled": true,
	})

	agent := JobAgent{
		ID:     "agent1",
		Name:   "Test Agent",
		Config: config1,
	}
	memSQL.Insert(agent)

	// Update with new config (delete and re-insert)
	config2, _ := structpb.NewStruct(map[string]interface{}{
		"version":  "2.0.0",
		"enabled":  false,
		"newField": "value",
	})

	memSQL.DeleteOne("id = ?", "agent1")
	agent.Config = config2
	memSQL.Insert(agent)

	// Query back
	agents, _ := memSQL.Query("SELECT * FROM job_agents WHERE id = ?", "agent1")

	if len(agents) != 1 {
		t.Fatalf("Expected 1 agent, got %d", len(agents))
	}

	// Verify updated config
	fields := agents[0].Config.Fields
	if fields["version"].GetStringValue() != "2.0.0" {
		t.Errorf("Expected version=2.0.0, got %s", fields["version"].GetStringValue())
	}
	if fields["enabled"].GetBoolValue() != false {
		t.Errorf("Expected enabled=false, got %v", fields["enabled"].GetBoolValue())
	}
	if fields["newField"].GetStringValue() != "value" {
		t.Errorf("Expected newField=value, got %s", fields["newField"].GetStringValue())
	}
}

func TestMemSQL_StructPB_Delete(t *testing.T) {
	type JobAgent struct {
		ID     string           `json:"id"`
		Name   string           `json:"name"`
		Config *structpb.Struct `json:"config"`
	}

	tableBuilder := NewTableBuilder("job_agents").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("config", "TEXT").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[JobAgent](tableBuilder)

	// Insert agents with configs
	config1, _ := structpb.NewStruct(map[string]interface{}{"type": "k8s"})
	config2, _ := structpb.NewStruct(map[string]interface{}{"type": "docker"})

	memSQL.InsertMany([]JobAgent{
		{ID: "agent1", Name: "Agent 1", Config: config1},
		{ID: "agent2", Name: "Agent 2", Config: config2},
	})

	// Delete one
	rowsAffected, err := memSQL.Delete("id = ?", "agent1")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	if rowsAffected != 1 {
		t.Errorf("Expected 1 row affected, got %d", rowsAffected)
	}

	// Verify only agent2 remains
	agents, _ := memSQL.Query("SELECT * FROM job_agents")
	if len(agents) != 1 {
		t.Errorf("Expected 1 agent remaining, got %d", len(agents))
	}

	if agents[0].ID != "agent2" {
		t.Errorf("Expected agent2, got %s", agents[0].ID)
	}
}

func TestMemSQL_StructPB_QueryWithWhere(t *testing.T) {
	type JobAgent struct {
		ID     string           `json:"id"`
		Name   string           `json:"name"`
		Config *structpb.Struct `json:"config"`
	}

	tableBuilder := NewTableBuilder("job_agents_query").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("config", "TEXT").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[JobAgent](tableBuilder)

	// Insert multiple agents
	config1, _ := structpb.NewStruct(map[string]interface{}{"enabled": true})
	config2, _ := structpb.NewStruct(map[string]interface{}{"enabled": false})

	memSQL.InsertMany([]JobAgent{
		{ID: "agent1", Name: "Active Agent", Config: config1},
		{ID: "agent2", Name: "Inactive Agent", Config: config2},
	})

	// Query specific agent with exact match
	agents, err := memSQL.Query("SELECT * FROM job_agents_query WHERE name = ?", "Active Agent")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(agents) != 1 {
		t.Fatalf("Expected 1 agent, got %d", len(agents))
	}

	if agents[0].ID != "agent1" {
		t.Errorf("Expected agent1, got %s", agents[0].ID)
	}

	// Verify config is still there
	if agents[0].Config == nil {
		t.Fatal("Config should not be nil")
	}
}

func TestMemSQL_Insert_Upsert(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert initial record
	user1 := User{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30}
	err := memSQL.Insert(user1)
	if err != nil {
		t.Fatalf("First insert failed: %v", err)
	}

	// Insert again with same ID (should update)
	user2 := User{ID: "1", Name: "Alice Updated", Email: "alice.new@example.com", Age: 31}
	err = memSQL.Insert(user2)
	if err != nil {
		t.Fatalf("Second insert (upsert) failed: %v", err)
	}

	// Verify record was updated, not duplicated
	users, _ := memSQL.Query("SELECT * FROM users WHERE ID = ?", "1")
	if len(users) != 1 {
		t.Fatalf("Expected 1 user, got %d", len(users))
	}

	// Verify fields were updated
	if users[0].Name != "Alice Updated" {
		t.Errorf("Expected name 'Alice Updated', got %s", users[0].Name)
	}
	if users[0].Email != "alice.new@example.com" {
		t.Errorf("Expected email 'alice.new@example.com', got %s", users[0].Email)
	}
	if users[0].Age != 31 {
		t.Errorf("Expected age 31, got %d", users[0].Age)
	}
}

func TestMemSQL_InsertMany_Upsert(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Initial insert
	users1 := []User{
		{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30},
		{ID: "2", Name: "Bob", Email: "bob@example.com", Age: 25},
	}
	err := memSQL.InsertMany(users1)
	if err != nil {
		t.Fatalf("First InsertMany failed: %v", err)
	}

	// Insert again with overlapping IDs (should upsert)
	users2 := []User{
		{ID: "1", Name: "Alice Updated", Email: "alice.new@example.com", Age: 31},
		{ID: "3", Name: "Charlie", Email: "charlie@example.com", Age: 35},
	}
	err = memSQL.InsertMany(users2)
	if err != nil {
		t.Fatalf("Second InsertMany (upsert) failed: %v", err)
	}

	// Verify we have 3 users total
	allUsers, _ := memSQL.Query("SELECT * FROM users ORDER BY ID")
	if len(allUsers) != 3 {
		t.Fatalf("Expected 3 users, got %d", len(allUsers))
	}

	// Verify Alice was updated
	if allUsers[0].ID != "1" || allUsers[0].Name != "Alice Updated" || allUsers[0].Age != 31 {
		t.Errorf("Alice not updated correctly: %+v", allUsers[0])
	}

	// Verify Bob unchanged
	if allUsers[1].ID != "2" || allUsers[1].Name != "Bob" || allUsers[1].Age != 25 {
		t.Errorf("Bob was changed unexpectedly: %+v", allUsers[1])
	}

	// Verify Charlie was inserted
	if allUsers[2].ID != "3" || allUsers[2].Name != "Charlie" {
		t.Errorf("Charlie not inserted correctly: %+v", allUsers[2])
	}
}

func TestMemSQL_Insert_Upsert_CompositePrimaryKey(t *testing.T) {
	type UserRole struct {
		UserID    string `json:"user_id"`
		RoleID    string `json:"role_id"`
		GrantedAt string `json:"granted_at"`
	}

	tableBuilder := NewTableBuilder("user_roles").
		WithColumn("user_id", "TEXT NOT NULL").
		WithColumn("role_id", "TEXT NOT NULL").
		WithColumn("granted_at", "TEXT").
		WithPrimaryKey("user_id", "role_id")

	memSQL := NewMemSQL[UserRole](tableBuilder)

	// Insert initial record
	role1 := UserRole{UserID: "u1", RoleID: "admin", GrantedAt: "2024-01-01"}
	err := memSQL.Insert(role1)
	if err != nil {
		t.Fatalf("First insert failed: %v", err)
	}

	// Insert again with same composite key (should update)
	role2 := UserRole{UserID: "u1", RoleID: "admin", GrantedAt: "2024-02-01"}
	err = memSQL.Insert(role2)
	if err != nil {
		t.Fatalf("Second insert (upsert) failed: %v", err)
	}

	// Verify record was updated
	roles, _ := memSQL.Query("SELECT * FROM user_roles WHERE user_id = ? AND role_id = ?", "u1", "admin")
	if len(roles) != 1 {
		t.Fatalf("Expected 1 role, got %d", len(roles))
	}

	if roles[0].GrantedAt != "2024-02-01" {
		t.Errorf("Expected GrantedAt '2024-02-01', got %s", roles[0].GrantedAt)
	}
}

func TestMemSQL_Insert_Upsert_WithTimestamp(t *testing.T) {
	type Event struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		CreatedAt string `json:"created_at"`
	}

	tableBuilder := NewTableBuilder("events").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("created_at", "INTEGER").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[Event](tableBuilder)

	// Insert initial event
	event1 := Event{ID: "e1", Name: "Event 1", CreatedAt: "2024-01-15T10:00:00Z"}
	err := memSQL.Insert(event1)
	if err != nil {
		t.Fatalf("First insert failed: %v", err)
	}

	// Upsert with new timestamp
	event2 := Event{ID: "e1", Name: "Event 1 Updated", CreatedAt: "2024-01-20T10:00:00Z"}
	err = memSQL.Insert(event2)
	if err != nil {
		t.Fatalf("Second insert (upsert) failed: %v", err)
	}

	// Verify was updated
	events, _ := memSQL.Query("SELECT * FROM events WHERE id = ?", "e1")
	if len(events) != 1 {
		t.Fatalf("Expected 1 event, got %d", len(events))
	}

	if events[0].Name != "Event 1 Updated" {
		t.Errorf("Expected name 'Event 1 Updated', got %s", events[0].Name)
	}

	// Verify timestamp was updated (it should be a valid timestamp string)
	if events[0].CreatedAt == "" {
		t.Error("CreatedAt should not be empty")
	}
}

func TestMemSQL_Insert_Upsert_WithStructPB(t *testing.T) {
	type JobAgent struct {
		ID     string           `json:"id"`
		Name   string           `json:"name"`
		Config *structpb.Struct `json:"config"`
	}

	tableBuilder := NewTableBuilder("job_agents_upsert").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("config", "TEXT").
		WithPrimaryKey("id")

	memSQL := NewMemSQL[JobAgent](tableBuilder)

	// Insert initial config
	config1, _ := structpb.NewStruct(map[string]interface{}{
		"version": "1.0.0",
		"enabled": true,
	})
	agent1 := JobAgent{ID: "agent1", Name: "Test Agent", Config: config1}
	memSQL.Insert(agent1)

	// Upsert with new config
	config2, _ := structpb.NewStruct(map[string]interface{}{
		"version": "2.0.0",
		"enabled": false,
	})
	agent2 := JobAgent{ID: "agent1", Name: "Test Agent Updated", Config: config2}
	memSQL.Insert(agent2)

	// Verify was updated
	agents, _ := memSQL.Query("SELECT * FROM job_agents_upsert WHERE id = ?", "agent1")
	if len(agents) != 1 {
		t.Fatalf("Expected 1 agent, got %d", len(agents))
	}

	if agents[0].Name != "Test Agent Updated" {
		t.Errorf("Expected name 'Test Agent Updated', got %s", agents[0].Name)
	}

	// Verify config was updated
	if agents[0].Config.Fields["version"].GetStringValue() != "2.0.0" {
		t.Errorf("Expected version 2.0.0, got %s", agents[0].Config.Fields["version"].GetStringValue())
	}
	if agents[0].Config.Fields["enabled"].GetBoolValue() != false {
		t.Errorf("Expected enabled false, got %v", agents[0].Config.Fields["enabled"].GetBoolValue())
	}
}

func TestMemSQL_InsertMany_Upsert_Mixed(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	memSQL := NewMemSQL[User](tableBuilder)

	// Insert 3 users initially
	memSQL.InsertMany([]User{
		{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30},
		{ID: "2", Name: "Bob", Email: "bob@example.com", Age: 25},
		{ID: "3", Name: "Charlie", Email: "charlie@example.com", Age: 35},
	})

	// Upsert: update 2, insert 2 new
	memSQL.InsertMany([]User{
		{ID: "1", Name: "Alice Updated", Email: "alice.new@example.com", Age: 31},
		{ID: "3", Name: "Charlie Updated", Email: "charlie.new@example.com", Age: 36},
		{ID: "4", Name: "David", Email: "david@example.com", Age: 40},
		{ID: "5", Name: "Eve", Email: "eve@example.com", Age: 28},
	})

	// Verify we have 5 users
	users, _ := memSQL.Query("SELECT * FROM users ORDER BY ID")
	if len(users) != 5 {
		t.Fatalf("Expected 5 users, got %d", len(users))
	}

	// Verify updates
	if users[0].Name != "Alice Updated" || users[0].Age != 31 {
		t.Errorf("Alice not updated: %+v", users[0])
	}
	if users[2].Name != "Charlie Updated" || users[2].Age != 36 {
		t.Errorf("Charlie not updated: %+v", users[2])
	}

	// Verify Bob unchanged
	if users[1].Name != "Bob" || users[1].Age != 25 {
		t.Errorf("Bob changed unexpectedly: %+v", users[1])
	}

	// Verify new inserts
	if users[3].ID != "4" || users[3].Name != "David" {
		t.Errorf("David not inserted: %+v", users[3])
	}
	if users[4].ID != "5" || users[4].Name != "Eve" {
		t.Errorf("Eve not inserted: %+v", users[4])
	}
}

func TestMemSQL_PointerType_Query(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	// Use pointer type
	memSQL := NewMemSQL[*User](tableBuilder)

	// Insert test data using raw SQL
	memSQL.DB().Exec(`
		INSERT INTO users (ID, Name, Email, Age) VALUES 
		('1', 'Alice', 'alice@example.com', 30),
		('2', 'Bob', 'bob@example.com', 25)
	`)

	// Query should work with pointer type
	users, err := memSQL.Query("SELECT * FROM users ORDER BY ID")
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}

	if len(users) != 2 {
		t.Fatalf("Expected 2 users, got %d", len(users))
	}

	// Verify data (users are pointers)
	if users[0].ID != "1" || users[0].Name != "Alice" {
		t.Errorf("User 1 data mismatch: %+v", users[0])
	}
	if users[1].ID != "2" || users[1].Name != "Bob" {
		t.Errorf("User 2 data mismatch: %+v", users[1])
	}
}

func TestMemSQL_PointerType_Insert(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	// Use pointer type
	memSQL := NewMemSQL[*User](tableBuilder)

	// Insert using pointer
	user := &User{
		ID:    "1",
		Name:  "Alice",
		Email: "alice@example.com",
		Age:   30,
	}

	err := memSQL.Insert(user)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	// Verify insert
	users, _ := memSQL.Query("SELECT * FROM users WHERE ID = ?", "1")
	if len(users) != 1 {
		t.Fatalf("Expected 1 user, got %d", len(users))
	}

	if users[0].Name != "Alice" || users[0].Age != 30 {
		t.Errorf("User data mismatch: %+v", users[0])
	}
}

func TestMemSQL_PointerType_InsertMany(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	// Use pointer type
	memSQL := NewMemSQL[*User](tableBuilder)

	// Insert using pointers
	users := []*User{
		{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30},
		{ID: "2", Name: "Bob", Email: "bob@example.com", Age: 25},
		{ID: "3", Name: "Charlie", Email: "charlie@example.com", Age: 35},
	}

	err := memSQL.InsertMany(users)
	if err != nil {
		t.Fatalf("InsertMany failed: %v", err)
	}

	// Verify inserts
	result, _ := memSQL.Query("SELECT * FROM users ORDER BY ID")
	if len(result) != 3 {
		t.Fatalf("Expected 3 users, got %d", len(result))
	}

	if result[0].Name != "Alice" || result[1].Name != "Bob" || result[2].Name != "Charlie" {
		t.Errorf("Users not inserted correctly")
	}
}

func TestMemSQL_PointerType_Upsert(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	// Use pointer type
	memSQL := NewMemSQL[*User](tableBuilder)

	// Initial insert
	user1 := &User{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30}
	memSQL.Insert(user1)

	// Upsert
	user2 := &User{ID: "1", Name: "Alice Updated", Email: "alice.new@example.com", Age: 31}
	memSQL.Insert(user2)

	// Verify update
	users, _ := memSQL.Query("SELECT * FROM users WHERE ID = ?", "1")
	if len(users) != 1 {
		t.Fatalf("Expected 1 user, got %d", len(users))
	}

	if users[0].Name != "Alice Updated" || users[0].Age != 31 {
		t.Errorf("User not updated: %+v", users[0])
	}
}

func TestMemSQL_PointerType_WithTimestamp(t *testing.T) {
	type Event struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		CreatedAt string `json:"created_at"`
	}

	tableBuilder := NewTableBuilder("events").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("created_at", "INTEGER").
		WithPrimaryKey("id")

	// Use pointer type
	memSQL := NewMemSQL[*Event](tableBuilder)

	// Insert with timestamp
	event := &Event{
		ID:        "e1",
		Name:      "Event 1",
		CreatedAt: "2024-01-15T10:00:00Z",
	}

	err := memSQL.Insert(event)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	// Query back
	events, _ := memSQL.Query("SELECT * FROM events WHERE id = ?", "e1")
	if len(events) != 1 {
		t.Fatalf("Expected 1 event, got %d", len(events))
	}

	if events[0].CreatedAt == "" {
		t.Error("CreatedAt should not be empty")
	}
}

func TestMemSQL_PointerType_WithStructPB(t *testing.T) {
	type JobAgent struct {
		ID     string           `json:"id"`
		Name   string           `json:"name"`
		Config *structpb.Struct `json:"config"`
	}

	tableBuilder := NewTableBuilder("job_agents_ptr").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("config", "TEXT").
		WithPrimaryKey("id")

	// Use pointer type
	memSQL := NewMemSQL[*JobAgent](tableBuilder)

	// Insert with config
	config, _ := structpb.NewStruct(map[string]interface{}{
		"api_key": "secret123",
		"enabled": true,
	})

	agent := &JobAgent{
		ID:     "agent1",
		Name:   "K8s Agent",
		Config: config,
	}

	err := memSQL.Insert(agent)
	if err != nil {
		t.Fatalf("Insert failed: %v", err)
	}

	// Query back
	agents, _ := memSQL.Query("SELECT * FROM job_agents_ptr WHERE id = ?", "agent1")
	if len(agents) != 1 {
		t.Fatalf("Expected 1 agent, got %d", len(agents))
	}

	if agents[0].Config == nil {
		t.Fatal("Config should not be nil")
	}

	if agents[0].Config.Fields["api_key"].GetStringValue() != "secret123" {
		t.Errorf("Config not deserialized correctly")
	}
}

func TestMemSQL_PointerType_InsertNilPointer(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	// Use pointer type
	memSQL := NewMemSQL[*User](tableBuilder)

	// Try to insert nil pointer
	var user *User = nil
	err := memSQL.Insert(user)

	if err == nil {
		t.Fatal("Expected error for nil pointer, got nil")
	}
}

func TestMemSQL_PointerType_InsertManyWithNil(t *testing.T) {
	tableBuilder := NewTableBuilder("users").
		WithColumn("ID", "TEXT NOT NULL").
		WithColumn("Name", "TEXT").
		WithColumn("Email", "TEXT").
		WithColumn("Age", "INTEGER").
		WithPrimaryKey("ID")

	// Use pointer type
	memSQL := NewMemSQL[*User](tableBuilder)

	// Insert with some nil pointers (should skip them)
	users := []*User{
		{ID: "1", Name: "Alice", Email: "alice@example.com", Age: 30},
		nil, // Should be skipped
		{ID: "2", Name: "Bob", Email: "bob@example.com", Age: 25},
	}

	err := memSQL.InsertMany(users)
	if err != nil {
		t.Fatalf("InsertMany failed: %v", err)
	}

	// Verify only 2 users inserted (nil was skipped)
	result, _ := memSQL.Query("SELECT * FROM users ORDER BY ID")
	if len(result) != 2 {
		t.Fatalf("Expected 2 users, got %d", len(result))
	}

	if result[0].ID != "1" || result[1].ID != "2" {
		t.Errorf("Wrong users inserted")
	}
}
