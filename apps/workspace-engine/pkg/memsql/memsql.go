package memsql

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
	"sync/atomic"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"google.golang.org/protobuf/types/known/structpb"
)

var dbCounter uint64

func NewMemSQL[T any](tableBuilder *TableBuilder) *MemSQL[T] {
	tableName := tableBuilder.TableName()
	
	// Use a temporary file-based database to support WAL mode (in-memory databases don't support WAL)
	// WAL mode enables concurrent readers without blocking on writes, critical for performance
	// Each database gets a unique ID to prevent conflicts when tests reuse table names
	dbID := atomic.AddUint64(&dbCounter, 1)
	dbName := fmt.Sprintf("/tmp/%s_%d_%d.db", tableName, dbID, time.Now().UnixNano())
	db, err := sql.Open("sqlite3", dbName)
	if err != nil {
		panic(fmt.Sprintf("failed to open database: %v", err))
	}

	// Set busy timeout to handle concurrent access (10 seconds)
	if _, err := db.Exec("PRAGMA busy_timeout=10000"); err != nil {
		panic(fmt.Sprintf("failed to set busy timeout: %v", err))
	}

	// Enable WAL mode for concurrent reads without blocking writes
	// This is the key setting that allows multiple readers + one writer concurrently
	var journalMode string
	err = db.QueryRow("PRAGMA journal_mode=WAL").Scan(&journalMode)
	if err != nil {
		panic(fmt.Sprintf("failed to enable WAL mode: %v", err))
	}
	if journalMode != "wal" {
		panic(fmt.Sprintf("WAL mode not enabled, got: %s", journalMode))
	}

	// Optimize for concurrent access and performance
	db.SetMaxOpenConns(50)      // Allow many concurrent readers
	db.SetMaxIdleConns(10)      // Keep some connections ready
	db.SetConnMaxLifetime(0)    // Don't close connections (in-memory database)
	
	// Additional performance optimizations
	db.Exec("PRAGMA synchronous=NORMAL")  // Faster, still safe for in-memory
	db.Exec("PRAGMA cache_size=-64000")   // 64MB cache
	db.Exec("PRAGMA temp_store=MEMORY")   // Use RAM for temp tables

	// Drop table if it exists, then create it fresh
	if _, err := db.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", tableName)); err != nil {
		panic(fmt.Sprintf("failed to drop table %s: %v", tableName, err))
	}
	
	if _, err := db.Exec(tableBuilder.Build()); err != nil {
		panic(fmt.Sprintf("failed to create table %s: %v", tableName, err))
	}
	return &MemSQL[T]{
		db:          db,
		tableName:   tableName,
		primaryKeys: tableBuilder.primaryKeys,
	}
}

type MemSQL[T any] struct {
	db          *sql.DB
	tableName   string
	primaryKeys []string
}

func (m *MemSQL[T]) DB() *sql.DB {
	return m.db
}

func (m *MemSQL[T]) TableName() string {
	return m.tableName
}

// Query executes a SQL query and parses the results into a slice of T.
// It uses reflection to map column names to struct fields (case-insensitive).
// Struct fields should use `json` tags to specify column names, or field names will be used directly.
func (m *MemSQL[T]) Query(query string, args ...any) ([]T, error) {
	rows, err := m.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer func() {
		// Explicitly ignore Close error - this is cleanup, main error takes precedence
		_ = rows.Close()
	}()

	return m.parseRows(rows)
}

// parseRows converts SQL rows into a slice of T using reflection.
func (m *MemSQL[T]) parseRows(rows *sql.Rows) ([]T, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	var results []T
	var t T
	typ := reflect.TypeOf(t)

	// If T is a pointer type, get the underlying struct type
	isPointer := false
	if typ.Kind() == reflect.Ptr {
		isPointer = true
		typ = typ.Elem()
	}

	if typ.Kind() != reflect.Struct {
		return nil, fmt.Errorf("item must be a struct or pointer to struct, got %s", typ.Kind())
	}

	// Build a map from column names to struct field indices
	fieldMap := make(map[string]int)
	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)

		// Check for json tag first (e.g., `json:"user_id,omitempty"`)
		jsonTag := field.Tag.Get("json")
		if jsonTag != "" && jsonTag != "-" {
			// Extract the field name (before the comma)
			jsonName := strings.Split(jsonTag, ",")[0]
			if jsonName != "" {
				fieldMap[strings.ToLower(jsonName)] = i
			}
		} else {
			// Use field name (case-insensitive)
			fieldMap[strings.ToLower(field.Name)] = i
		}
	}

	for rows.Next() {
		// Create pointers to scan into
		values := make([]any, len(columns))
		valuePtrs := make([]any, len(columns))

		// Create a new instance of the underlying struct type
		itemPtr := reflect.New(typ)
		item := itemPtr.Elem()

		for i, col := range columns {
			colLower := strings.ToLower(col)
			if fieldIdx, ok := fieldMap[colLower]; ok {
				// Get a pointer to the struct field
				field := item.Field(fieldIdx)
				fieldType := typ.Field(fieldIdx)

				// Check if this is a timestamp field (string that maps to INTEGER in DB)
				if field.Kind() == reflect.String && isTimestampField(fieldType) {
					// Scan as sql.NullInt64 to handle NULL values
					var timestamp sql.NullInt64
					valuePtrs[i] = &timestamp
					values[i] = &timestamp
				} else if isStructPBField(fieldType) {
					// Scan structpb.Struct fields as JSON string
					var jsonStr sql.NullString
					valuePtrs[i] = &jsonStr
					values[i] = &jsonStr
				} else if needsJSONSerializationType(fieldType.Type) {
					// Scan structs, maps, and slices as JSON string
					var jsonStr sql.NullString
					valuePtrs[i] = &jsonStr
					values[i] = &jsonStr
				} else if field.CanAddr() {
					valuePtrs[i] = field.Addr().Interface()
				} else {
					valuePtrs[i] = &values[i]
				}
			} else {
				// No matching field, scan into a dummy variable
				valuePtrs[i] = &values[i]
			}
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		// Convert special types back to their Go representations
		for i, col := range columns {
			colLower := strings.ToLower(col)
			if fieldIdx, ok := fieldMap[colLower]; ok {
				field := item.Field(fieldIdx)
				fieldType := typ.Field(fieldIdx)

				// Handle timestamp fields
				if field.Kind() == reflect.String && isTimestampField(fieldType) {
					if nullTimestamp, ok := values[i].(*sql.NullInt64); ok && nullTimestamp.Valid && nullTimestamp.Int64 > 0 {
						// Convert Unix timestamp (seconds) to RFC3339 string
						timeStr := time.Unix(nullTimestamp.Int64, 0).UTC().Format(time.RFC3339)
						field.SetString(timeStr)
					}
				} else if isStructPBField(fieldType) {
					// Handle structpb.Struct fields
					if nullStr, ok := values[i].(*sql.NullString); ok && nullStr.Valid && nullStr.String != "" {
						var pbStruct structpb.Struct
						if err := json.Unmarshal([]byte(nullStr.String), &pbStruct); err == nil {
							field.Set(reflect.ValueOf(&pbStruct))
						}
					}
				} else if needsJSONSerializationType(fieldType.Type) {
					// Handle struct, map, and slice fields that were stored as JSON
					if nullStr, ok := values[i].(*sql.NullString); ok && nullStr.Valid && nullStr.String != "" {
						// For pointer types, we need to create a new instance
						if field.Kind() == reflect.Ptr {
							// Create a new instance of the pointed-to type
							newVal := reflect.New(field.Type().Elem())
							if err := json.Unmarshal([]byte(nullStr.String), newVal.Interface()); err == nil {
								field.Set(newVal)
							}
						} else if field.CanAddr() {
							// For non-pointer types, unmarshal directly into the field
							fieldPtr := field.Addr().Interface()
							if err := json.Unmarshal([]byte(nullStr.String), fieldPtr); err != nil {
								// Log error but continue - field will remain zero value
								continue
							}
						}
					}
				}
			}
		}

		// Return pointer or value based on T's type
		if isPointer {
			results = append(results, itemPtr.Interface().(T))
		} else {
			results = append(results, item.Interface().(T))
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	return results, nil
}

// QueryOne executes a SQL query and returns a single result.
// Returns an error if no rows are found or if multiple rows are returned.
func (m *MemSQL[T]) QueryOne(query string, args ...any) (T, error) {
	results, err := m.Query(query, args...)
	if err != nil {
		var zero T
		return zero, err
	}

	if len(results) == 0 {
		var zero T
		return zero, sql.ErrNoRows
	}

	if len(results) > 1 {
		var zero T
		return zero, fmt.Errorf("expected 1 row, got %d", len(results))
	}

	return results[0], nil
}

// Delete deletes records from the table based on a WHERE clause.
// Returns the number of rows affected.
// Example: Delete("id = ?", "123") or Delete("created_at < ?", timestamp)
func (m *MemSQL[T]) Delete(whereClause string, args ...any) (int64, error) {
	if whereClause == "" {
		return 0, fmt.Errorf("whereClause cannot be empty (use 'true' or '1=1' to delete all)")
	}

	query := fmt.Sprintf("DELETE FROM %s WHERE %s", m.tableName, whereClause)

	result, err := m.db.Exec(query, args...)
	if err != nil {
		return 0, fmt.Errorf("delete failed: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	return rowsAffected, nil
}

// DeleteOne deletes a single record from the table based on a WHERE clause.
// Returns an error if no rows are deleted or if multiple rows would be deleted.
func (m *MemSQL[T]) DeleteOne(whereClause string, args ...any) error {
	if whereClause == "" {
		return fmt.Errorf("whereClause cannot be empty")
	}

	// First check how many rows match
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s", m.tableName, whereClause)
	var count int64
	err := m.db.QueryRow(countQuery, args...).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to count matching rows: %w", err)
	}

	if count == 0 {
		return sql.ErrNoRows
	}

	if count > 1 {
		return fmt.Errorf("expected 1 row to delete, found %d", count)
	}

	// Now delete the single row
	_, err = m.Delete(whereClause, args...)
	return err
}

// Insert inserts a single record into the table.
// It uses reflection to extract field values and json tags for column names.
func (m *MemSQL[T]) Insert(item T) error {
	val := reflect.ValueOf(item)
	typ := reflect.TypeOf(item)

	// If item is a pointer, dereference it
	if val.Kind() == reflect.Pointer {
		if val.IsNil() {
			return fmt.Errorf("cannot insert nil pointer")
		}
		val = val.Elem()
		typ = typ.Elem()
	}

	if typ.Kind() != reflect.Struct {
		return fmt.Errorf("item must be a struct or pointer to struct, got %s", typ.Kind())
	}

	var columns []string
	var placeholders []string
	var values []any

	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		fieldValue := val.Field(i)

		// Skip unexported fields
		if !field.IsExported() {
			continue
		}

		// Get column name from json tag or field name
		columnName := getColumnName(field)
		if columnName == "" || columnName == "-" {
			continue
		}

		columns = append(columns, columnName)
		placeholders = append(placeholders, "?")

		// Convert timestamp strings to Unix timestamps
		if fieldValue.Kind() == reflect.String && isTimestampField(field) {
			timeStr := fieldValue.String()
			if timeStr != "" {
				if timestamp, err := parseTimestamp(timeStr); err == nil {
					values = append(values, timestamp)
				} else {
					values = append(values, fieldValue.Interface())
				}
			} else {
				values = append(values, nil)
			}
		} else if isStructPBField(field) {
			// Convert structpb.Struct to JSON
			if fieldValue.IsNil() {
				values = append(values, nil)
			} else {
				if pbStruct, ok := fieldValue.Interface().(*structpb.Struct); ok {
					if jsonBytes, err := json.Marshal(pbStruct); err == nil {
						values = append(values, string(jsonBytes))
					} else {
						values = append(values, nil)
					}
				} else {
					values = append(values, nil)
				}
			}
		} else if needsJSONSerialization(fieldValue) {
			// Convert structs, maps, and slices to JSON
			if jsonBytes, err := json.Marshal(fieldValue.Interface()); err == nil {
				values = append(values, string(jsonBytes))
			} else {
				values = append(values, nil)
			}
		} else {
			values = append(values, fieldValue.Interface())
		}
	}

	if len(columns) == 0 {
		return fmt.Errorf("no fields to insert")
	}

	// Build upsert query with ON CONFLICT clause
	query := fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES (%s)",
		m.tableName,
		strings.Join(columns, ", "),
		strings.Join(placeholders, ", "),
	)

	// Add ON CONFLICT clause for upsert behavior
	if len(m.primaryKeys) > 0 {
		var updateClauses []string
		for _, col := range columns {
			// Don't update primary key columns
			isPrimaryKey := false
			for _, pk := range m.primaryKeys {
				if strings.EqualFold(col, pk) {
					isPrimaryKey = true
					break
				}
			}
			if !isPrimaryKey {
				updateClauses = append(updateClauses, fmt.Sprintf("%s = excluded.%s", col, col))
			}
		}

		if len(updateClauses) > 0 {
			query += fmt.Sprintf(
				" ON CONFLICT(%s) DO UPDATE SET %s",
				strings.Join(m.primaryKeys, ", "),
				strings.Join(updateClauses, ", "),
			)
		} else {
			// All columns are primary keys, just ignore conflicts
			query += fmt.Sprintf(" ON CONFLICT(%s) DO NOTHING", strings.Join(m.primaryKeys, ", "))
		}
	}

	_, err := m.db.Exec(query, values...)
	if err != nil {
		return fmt.Errorf("insert failed: %w", err)
	}

	return nil
}

// InsertMany inserts multiple records into the table in a single transaction.
// It uses reflection to extract field values and json tags for column names.
func (m *MemSQL[T]) InsertMany(items []T) error {
	if len(items) == 0 {
		return nil
	}

	// Start transaction
	tx, err := m.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() {
		// Explicitly ignore Rollback error - if Commit succeeds, Rollback will error (expected)
		// If function errors before Commit, Rollback cleans up (error already being returned)
		_ = tx.Rollback()
	}()

	// Get column names from the first item
	typ := reflect.TypeOf(items[0])

	// If item is a pointer, dereference it
	if typ.Kind() == reflect.Ptr {
		typ = typ.Elem()
	}

	if typ.Kind() != reflect.Struct {
		return fmt.Errorf("items must be structs or pointers to structs, got %s", typ.Kind())
	}

	var columns []string
	var fieldIndices []int

	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)

		// Skip unexported fields
		if !field.IsExported() {
			continue
		}

		// Get column name from json tag or field name
		columnName := getColumnName(field)
		if columnName == "" || columnName == "-" {
			continue
		}

		columns = append(columns, columnName)
		fieldIndices = append(fieldIndices, i)
	}

	if len(columns) == 0 {
		return fmt.Errorf("no fields to insert")
	}

	// Build placeholders
	placeholders := make([]string, len(columns))
	for i := range placeholders {
		placeholders[i] = "?"
	}

	// Build upsert query with ON CONFLICT clause
	query := fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES (%s)",
		m.tableName,
		strings.Join(columns, ", "),
		strings.Join(placeholders, ", "),
	)

	// Add ON CONFLICT clause for upsert behavior
	if len(m.primaryKeys) > 0 {
		var updateClauses []string
		for _, col := range columns {
			// Don't update primary key columns
			isPrimaryKey := false
			for _, pk := range m.primaryKeys {
				if strings.EqualFold(col, pk) {
					isPrimaryKey = true
					break
				}
			}
			if !isPrimaryKey {
				updateClauses = append(updateClauses, fmt.Sprintf("%s = excluded.%s", col, col))
			}
		}

		if len(updateClauses) > 0 {
			query += fmt.Sprintf(
				" ON CONFLICT(%s) DO UPDATE SET %s",
				strings.Join(m.primaryKeys, ", "),
				strings.Join(updateClauses, ", "),
			)
		} else {
			// All columns are primary keys, just ignore conflicts
			query += fmt.Sprintf(" ON CONFLICT(%s) DO NOTHING", strings.Join(m.primaryKeys, ", "))
		}
	}

	// Prepare statement
	stmt, err := tx.Prepare(query)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer func() {
		// Explicitly ignore Close error - this is cleanup
		_ = stmt.Close()
	}()

	// Insert each item
	for _, item := range items {
		val := reflect.ValueOf(item)

		// If item is a pointer, dereference it
		if val.Kind() == reflect.Ptr {
			if val.IsNil() {
				continue // Skip nil pointers
			}
			val = val.Elem()
		}

		values := make([]any, len(fieldIndices))
		for i, fieldIdx := range fieldIndices {
			fieldValue := val.Field(fieldIdx)
			field := typ.Field(fieldIdx)

			// Convert timestamp strings to Unix timestamps
			if fieldValue.Kind() == reflect.String && isTimestampField(field) {
				timeStr := fieldValue.String()
				if timeStr != "" {
					if timestamp, err := parseTimestamp(timeStr); err == nil {
						values[i] = timestamp
					} else {
						values[i] = fieldValue.Interface()
					}
				} else {
					values[i] = nil
				}
			} else if isStructPBField(field) {
				// Convert structpb.Struct to JSON
				if fieldValue.IsNil() {
					values[i] = nil
				} else {
					if pbStruct, ok := fieldValue.Interface().(*structpb.Struct); ok {
						if jsonBytes, err := json.Marshal(pbStruct); err == nil {
							values[i] = string(jsonBytes)
						} else {
							values[i] = nil
						}
					} else {
						values[i] = nil
					}
				}
			} else if needsJSONSerialization(fieldValue) {
				// Convert structs, maps, and slices to JSON
				if jsonBytes, err := json.Marshal(fieldValue.Interface()); err == nil {
					values[i] = string(jsonBytes)
				} else {
					values[i] = nil
				}
			} else {
				values[i] = fieldValue.Interface()
			}
		}

		if _, err := stmt.Exec(values...); err != nil {
			return fmt.Errorf("failed to insert row: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// getColumnName extracts the column name from a struct field.
// It checks json tags first, then falls back to the field name.
func getColumnName(field reflect.StructField) string {
	// Check for json tag first
	jsonTag := field.Tag.Get("json")
	if jsonTag != "" && jsonTag != "-" {
		// Extract the field name (before the comma)
		parts := strings.Split(jsonTag, ",")
		if len(parts) > 0 && parts[0] != "" {
			return parts[0]
		}
	}

	// Use field name as fallback (convert to snake_case would be nice, but keeping it simple)
	return field.Name
}

// isTimestampField checks if a field should be treated as a timestamp.
// It checks for common timestamp field naming patterns.
func isTimestampField(field reflect.StructField) bool {
	if field.Type.Kind() != reflect.String {
		return false
	}

	columnName := strings.ToLower(getColumnName(field))
	fieldName := strings.ToLower(field.Name)

	// Check for common timestamp field patterns
	timestampPatterns := []string{
		"created_at", "createdat",
		"updated_at", "updatedat",
		"deleted_at", "deletedat",
		"timestamp", "time",
		"date", "datetime",
	}

	for _, pattern := range timestampPatterns {
		if strings.Contains(columnName, pattern) || strings.Contains(fieldName, pattern) {
			return true
		}
	}

	return false
}

// parseTimestamp parses a timestamp string and returns Unix timestamp (seconds).
// Supports RFC3339, ISO8601, and other common formats.
func parseTimestamp(timeStr string) (int64, error) {
	if timeStr == "" {
		return 0, fmt.Errorf("empty timestamp")
	}

	// Try common timestamp formats
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}

	for _, format := range formats {
		if t, err := time.Parse(format, timeStr); err == nil {
			return t.Unix(), nil
		}
	}

	return 0, fmt.Errorf("unable to parse timestamp: %s", timeStr)
}

// isStructPBField checks if a field is a *structpb.Struct type.
func isStructPBField(field reflect.StructField) bool {
	return field.Type == reflect.TypeOf((*structpb.Struct)(nil))
}

// needsJSONSerialization checks if a field value should be JSON-serialized before storage.
// Returns true for structs, maps, slices (except []byte), and pointers to these types.
func needsJSONSerialization(v reflect.Value) bool {
	// Handle nil pointers
	if v.Kind() == reflect.Ptr && v.IsNil() {
		return false
	}
	
	// Dereference pointers
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	
	switch v.Kind() {
	case reflect.Struct:
		// Don't serialize time.Time as JSON (it's handled specially elsewhere)
		if v.Type() == reflect.TypeOf(time.Time{}) {
			return false
		}
		// Don't serialize *structpb.Struct as it's handled separately
		if v.Type() == reflect.TypeOf(structpb.Struct{}) {
			return false
		}
		return true
	case reflect.Map:
		return true
	case reflect.Slice:
		// Don't serialize []byte as JSON (store as BLOB)
		if v.Type().Elem().Kind() == reflect.Uint8 {
			return false
		}
		return true
	default:
		return false
	}
}

// needsJSONSerializationType checks if a field type should be JSON-serialized before storage.
// This is similar to needsJSONSerialization but works with types instead of values.
// Returns true for structs, maps, slices (except []byte), and pointers to these types.
func needsJSONSerializationType(t reflect.Type) bool {
	// Dereference pointers
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	
	switch t.Kind() {
	case reflect.Struct:
		// Don't serialize time.Time as JSON (it's handled specially elsewhere)
		if t == reflect.TypeOf(time.Time{}) {
			return false
		}
		// Don't serialize structpb.Struct as it's handled separately
		if t == reflect.TypeOf(structpb.Struct{}) {
			return false
		}
		return true
	case reflect.Map:
		return true
	case reflect.Slice:
		// Don't serialize []byte as JSON (store as BLOB)
		if t.Elem().Kind() == reflect.Uint8 {
			return false
		}
		return true
	default:
		return false
	}
}
