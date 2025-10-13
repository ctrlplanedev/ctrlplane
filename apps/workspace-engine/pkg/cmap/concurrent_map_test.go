package cmap

import (
	"encoding/json"
	"hash/fnv"
	"sort"
	"strconv"
	"testing"
)

type Animal struct {
	name string
}

// SerializableAnimal is like Animal but with an exported field for JSON serialization
type SerializableAnimal struct {
	Name string `json:"name"`
}

func TestMapCreation(t *testing.T) {
	m := New[string]()
	if m.shards == nil {
		t.Error("map is null.")
	}

	if m.Count() != 0 {
		t.Error("new map should be empty.")
	}
}

func TestInsert(t *testing.T) {
	m := New[Animal]()
	elephant := Animal{"elephant"}
	monkey := Animal{"monkey"}

	m.Set("elephant", elephant)
	m.Set("monkey", monkey)

	if m.Count() != 2 {
		t.Error("map should contain exactly two elements.")
	}
}

func TestInsertAbsent(t *testing.T) {
	m := New[Animal]()
	elephant := Animal{"elephant"}
	monkey := Animal{"monkey"}

	m.SetIfAbsent("elephant", elephant)
	if ok := m.SetIfAbsent("elephant", monkey); ok {
		t.Error("map set a new value even the entry is already present")
	}
}

func TestGet(t *testing.T) {
	m := New[Animal]()

	// Get a missing element.
	val, ok := m.Get("Money")

	if ok == true {
		t.Error("ok should be false when item is missing from map.")
	}

	if (val != Animal{}) {
		t.Error("Missing values should return as null.")
	}

	elephant := Animal{"elephant"}
	m.Set("elephant", elephant)

	// Retrieve inserted element.
	elephant, ok = m.Get("elephant")
	if ok == false {
		t.Error("ok should be true for item stored within the map.")
	}

	if elephant.name != "elephant" {
		t.Error("item was modified.")
	}
}

func TestHas(t *testing.T) {
	m := New[Animal]()

	// Get a missing element.
	if m.Has("Money") == true {
		t.Error("element shouldn't exists")
	}

	elephant := Animal{"elephant"}
	m.Set("elephant", elephant)

	if m.Has("elephant") == false {
		t.Error("element exists, expecting Has to return True.")
	}
}

func TestRemove(t *testing.T) {
	m := New[Animal]()

	monkey := Animal{"monkey"}
	m.Set("monkey", monkey)

	m.Remove("monkey")

	if m.Count() != 0 {
		t.Error("Expecting count to be zero once item was removed.")
	}

	temp, ok := m.Get("monkey")

	if ok != false {
		t.Error("Expecting ok to be false for missing items.")
	}

	if (temp != Animal{}) {
		t.Error("Expecting item to be nil after its removal.")
	}

	// Remove a none existing element.
	m.Remove("noone")
}

func TestRemoveCb(t *testing.T) {
	m := New[Animal]()

	monkey := Animal{"monkey"}
	m.Set("monkey", monkey)
	elephant := Animal{"elephant"}
	m.Set("elephant", elephant)

	var (
		mapKey   string
		mapVal   Animal
		wasFound bool
	)
	cb := func(key string, val Animal, exists bool) bool {
		mapKey = key
		mapVal = val
		wasFound = exists

		return val.name == "monkey"
	}

	// Monkey should be removed
	result := m.RemoveCb("monkey", cb)
	if !result {
		t.Errorf("Result was not true")
	}

	if mapKey != "monkey" {
		t.Error("Wrong key was provided to the callback")
	}

	if mapVal != monkey {
		t.Errorf("Wrong value was provided to the value")
	}

	if !wasFound {
		t.Errorf("Key was not found")
	}

	if m.Has("monkey") {
		t.Errorf("Key was not removed")
	}

	// Elephant should not be removed
	result = m.RemoveCb("elephant", cb)
	if result {
		t.Errorf("Result was true")
	}

	if mapKey != "elephant" {
		t.Error("Wrong key was provided to the callback")
	}

	if mapVal != elephant {
		t.Errorf("Wrong value was provided to the value")
	}

	if !wasFound {
		t.Errorf("Key was not found")
	}

	if !m.Has("elephant") {
		t.Errorf("Key was removed")
	}

	// Unset key should remain unset
	result = m.RemoveCb("horse", cb)
	if result {
		t.Errorf("Result was true")
	}

	if mapKey != "horse" {
		t.Error("Wrong key was provided to the callback")
	}

	if (mapVal != Animal{}) {
		t.Errorf("Wrong value was provided to the value")
	}

	if wasFound {
		t.Errorf("Key was found")
	}

	if m.Has("horse") {
		t.Errorf("Key was created")
	}
}

func TestPop(t *testing.T) {
	m := New[Animal]()

	monkey := Animal{"monkey"}
	m.Set("monkey", monkey)

	v, exists := m.Pop("monkey")

	if !exists || v != monkey {
		t.Error("Pop didn't find a monkey.")
	}

	v2, exists2 := m.Pop("monkey")

	if exists2 || v2 == monkey {
		t.Error("Pop keeps finding monkey")
	}

	if m.Count() != 0 {
		t.Error("Expecting count to be zero once item was Pop'ed.")
	}

	temp, ok := m.Get("monkey")

	if ok != false {
		t.Error("Expecting ok to be false for missing items.")
	}

	if (temp != Animal{}) {
		t.Error("Expecting item to be nil after its removal.")
	}
}

func TestCount(t *testing.T) {
	m := New[Animal]()
	for i := 0; i < 100; i++ {
		m.Set(strconv.Itoa(i), Animal{strconv.Itoa(i)})
	}

	if m.Count() != 100 {
		t.Error("Expecting 100 element within map.")
	}
}

func TestIsEmpty(t *testing.T) {
	m := New[Animal]()

	if m.IsEmpty() == false {
		t.Error("new map should be empty")
	}

	m.Set("elephant", Animal{"elephant"})

	if m.IsEmpty() != false {
		t.Error("map shouldn't be empty.")
	}
}

func TestIterator(t *testing.T) {
	m := New[Animal]()

	// Insert 100 elements.
	for i := 0; i < 100; i++ {
		m.Set(strconv.Itoa(i), Animal{strconv.Itoa(i)})
	}

	counter := 0
	// Iterate over elements.
	for item := range m.Iter() {
		val := item.Val

		if (val == Animal{}) {
			t.Error("Expecting an object.")
		}
		counter++
	}

	if counter != 100 {
		t.Error("We should have counted 100 elements.")
	}
}

func TestBufferedIterator(t *testing.T) {
	m := New[Animal]()

	// Insert 100 elements.
	for i := 0; i < 100; i++ {
		m.Set(strconv.Itoa(i), Animal{strconv.Itoa(i)})
	}

	counter := 0
	// Iterate over elements.
	for item := range m.IterBuffered() {
		val := item.Val

		if (val == Animal{}) {
			t.Error("Expecting an object.")
		}
		counter++
	}

	if counter != 100 {
		t.Error("We should have counted 100 elements.")
	}
}

func TestClear(t *testing.T) {
	m := New[Animal]()

	// Insert 100 elements.
	for i := 0; i < 100; i++ {
		m.Set(strconv.Itoa(i), Animal{strconv.Itoa(i)})
	}

	m.Clear()

	if m.Count() != 0 {
		t.Error("We should have 0 elements.")
	}
}

func TestIterCb(t *testing.T) {
	m := New[Animal]()

	// Insert 100 elements.
	for i := 0; i < 100; i++ {
		m.Set(strconv.Itoa(i), Animal{strconv.Itoa(i)})
	}

	counter := 0
	// Iterate over elements.
	m.IterCb(func(key string, v Animal) {
		counter++
	})
	if counter != 100 {
		t.Error("We should have counted 100 elements.")
	}
}

func TestItems(t *testing.T) {
	m := New[Animal]()

	// Insert 100 elements.
	for i := 0; i < 100; i++ {
		m.Set(strconv.Itoa(i), Animal{strconv.Itoa(i)})
	}

	items := m.Items()

	if len(items) != 100 {
		t.Error("We should have counted 100 elements.")
	}
}

func TestConcurrent(t *testing.T) {
	m := New[int]()
	ch := make(chan int)
	const iterations = 1000
	var a [iterations]int

	// Using go routines insert 1000 ints into our map.
	go func() {
		for i := 0; i < iterations/2; i++ {
			// Add item to map.
			m.Set(strconv.Itoa(i), i)

			// Retrieve item from map.
			val, _ := m.Get(strconv.Itoa(i))

			// Write to channel inserted value.
			ch <- val
		} // Call go routine with current index.
	}()

	go func() {
		for i := iterations / 2; i < iterations; i++ {
			// Add item to map.
			m.Set(strconv.Itoa(i), i)

			// Retrieve item from map.
			val, _ := m.Get(strconv.Itoa(i))

			// Write to channel inserted value.
			ch <- val
		} // Call go routine with current index.
	}()

	// Wait for all go routines to finish.
	counter := 0
	for elem := range ch {
		a[counter] = elem
		counter++
		if counter == iterations {
			break
		}
	}

	// Sorts array, will make is simpler to verify all inserted values we're returned.
	sort.Ints(a[0:iterations])

	// Make sure map contains 1000 elements.
	if m.Count() != iterations {
		t.Error("Expecting 1000 elements.")
	}

	// Make sure all inserted values we're fetched from map.
	for i := 0; i < iterations; i++ {
		if i != a[i] {
			t.Error("missing value", i)
		}
	}
}

func TestJsonMarshal(t *testing.T) {
	SHARD_COUNT = 2
	defer func() {
		SHARD_COUNT = 32
	}()
	expected := "{\"a\":1,\"b\":2}"
	m := New[int]()
	m.Set("a", 1)
	m.Set("b", 2)
	j, err := json.Marshal(m)
	if err != nil {
		t.Error(err)
	}

	if string(j) != expected {
		t.Error("json", string(j), "differ from expected", expected)
		return
	}
}

func TestKeys(t *testing.T) {
	m := New[Animal]()

	// Insert 100 elements.
	for i := 0; i < 100; i++ {
		m.Set(strconv.Itoa(i), Animal{strconv.Itoa(i)})
	}

	keys := m.Keys()
	if len(keys) != 100 {
		t.Error("We should have counted 100 elements.")
	}
}

func TestMInsert(t *testing.T) {
	animals := map[string]Animal{
		"elephant": {"elephant"},
		"monkey":   {"monkey"},
	}
	m := New[Animal]()
	m.MSet(animals)

	if m.Count() != 2 {
		t.Error("map should contain exactly two elements.")
	}
}

func TestFnv32(t *testing.T) {
	key := []byte("ABC")

	hasher := fnv.New32()
	_, err := hasher.Write(key)
	if err != nil {
		t.Errorf("%s", err.Error())
	}
	if fnv32(string(key)) != hasher.Sum32() {
		t.Errorf("Bundled fnv32 produced %d, expected result from hash/fnv32 is %d", fnv32(string(key)), hasher.Sum32())
	}

}

func TestUpsert(t *testing.T) {
	dolphin := Animal{"dolphin"}
	whale := Animal{"whale"}
	tiger := Animal{"tiger"}
	lion := Animal{"lion"}

	cb := func(exists bool, valueInMap Animal, newValue Animal) Animal {
		if !exists {
			return newValue
		}
		valueInMap.name += newValue.name
		return valueInMap
	}

	m := New[Animal]()
	m.Set("marine", dolphin)
	m.Upsert("marine", whale, cb)
	m.Upsert("predator", tiger, cb)
	m.Upsert("predator", lion, cb)

	if m.Count() != 2 {
		t.Error("map should contain exactly two elements.")
	}

	marineAnimals, ok := m.Get("marine")
	if marineAnimals.name != "dolphinwhale" || !ok {
		t.Error("Set, then Upsert failed")
	}

	predators, ok := m.Get("predator")
	if !ok || predators.name != "tigerlion" {
		t.Error("Upsert, then Upsert failed")
	}
}

func TestKeysWhenRemoving(t *testing.T) {
	m := New[Animal]()

	// Insert 100 elements.
	Total := 100
	for i := 0; i < Total; i++ {
		m.Set(strconv.Itoa(i), Animal{strconv.Itoa(i)})
	}

	// Remove 10 elements concurrently.
	Num := 10
	for i := 0; i < Num; i++ {
		go func(c *ConcurrentMap[string, Animal], n int) {
			c.Remove(strconv.Itoa(n))
		}(&m, i)
	}
	keys := m.Keys()
	for _, k := range keys {
		if k == "" {
			t.Error("Empty keys returned")
		}
	}
}

func TestUnDrainedIter(t *testing.T) {
	m := New[Animal]()
	// Insert 100 elements.
	Total := 100
	for i := 0; i < Total; i++ {
		m.Set(strconv.Itoa(i), Animal{strconv.Itoa(i)})
	}
	counter := 0
	// Iterate over elements.
	ch := m.Iter()
	for item := range ch {
		val := item.Val

		if (val == Animal{}) {
			t.Error("Expecting an object.")
		}
		counter++
		if counter == 42 {
			break
		}
	}
	for i := Total; i < 2*Total; i++ {
		m.Set(strconv.Itoa(i), Animal{strconv.Itoa(i)})
	}
	for item := range ch {
		val := item.Val

		if (val == Animal{}) {
			t.Error("Expecting an object.")
		}
		counter++
	}

	if counter != 100 {
		t.Error("We should have been right where we stopped")
	}

	counter = 0
	for item := range m.IterBuffered() {
		val := item.Val

		if (val == Animal{}) {
			t.Error("Expecting an object.")
		}
		counter++
	}

	if counter != 200 {
		t.Error("We should have counted 200 elements.")
	}
}

func TestUnDrainedIterBuffered(t *testing.T) {
	m := New[Animal]()
	// Insert 100 elements.
	Total := 100
	for i := 0; i < Total; i++ {
		m.Set(strconv.Itoa(i), Animal{strconv.Itoa(i)})
	}
	counter := 0
	// Iterate over elements.
	ch := m.IterBuffered()
	for item := range ch {
		val := item.Val

		if (val == Animal{}) {
			t.Error("Expecting an object.")
		}
		counter++
		if counter == 42 {
			break
		}
	}
	for i := Total; i < 2*Total; i++ {
		m.Set(strconv.Itoa(i), Animal{strconv.Itoa(i)})
	}
	for item := range ch {
		val := item.Val

		if (val == Animal{}) {
			t.Error("Expecting an object.")
		}
		counter++
	}

	if counter != 100 {
		t.Error("We should have been right where we stopped")
	}

	counter = 0
	for item := range m.IterBuffered() {
		val := item.Val

		if (val == Animal{}) {
			t.Error("Expecting an object.")
		}
		counter++
	}

	if counter != 200 {
		t.Error("We should have counted 200 elements.")
	}
}

func TestGobEncode(t *testing.T) {
	m := New[SerializableAnimal]()
	elephant := SerializableAnimal{"elephant"}
	monkey := SerializableAnimal{"monkey"}
	dolphin := SerializableAnimal{"dolphin"}

	m.Set("elephant", elephant)
	m.Set("monkey", monkey)
	m.Set("dolphin", dolphin)

	// Encode the map
	encoded, err := m.GobEncode()
	if err != nil {
		t.Errorf("GobEncode failed: %v", err)
	}

	if len(encoded) == 0 {
		t.Error("Encoded data should not be empty")
	}

	// Verify it's valid JSON
	var decoded map[string]SerializableAnimal
	err = json.Unmarshal(encoded, &decoded)
	if err != nil {
		t.Errorf("Encoded data is not valid JSON: %v", err)
	}

	// Verify all elements are present
	if len(decoded) != 3 {
		t.Errorf("Expected 3 elements in decoded map, got %d", len(decoded))
	}

	if decoded["elephant"] != elephant {
		t.Error("Elephant not encoded correctly")
	}
	if decoded["monkey"] != monkey {
		t.Error("Monkey not encoded correctly")
	}
	if decoded["dolphin"] != dolphin {
		t.Error("Dolphin not encoded correctly")
	}
}

func TestGobDecode(t *testing.T) {
	// Create JSON data to decode
	data := map[string]SerializableAnimal{
		"elephant": {"elephant"},
		"monkey":   {"monkey"},
		"dolphin":  {"dolphin"},
	}
	encoded, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("Failed to create test data: %v", err)
	}

	// Decode into a new map
	m := New[SerializableAnimal]()
	err = m.GobDecode(encoded)
	if err != nil {
		t.Errorf("GobDecode failed: %v", err)
	}

	// Verify all elements are present
	if m.Count() != 3 {
		t.Errorf("Expected 3 elements in decoded map, got %d", m.Count())
	}

	elephant, ok := m.Get("elephant")
	if !ok || elephant.Name != "elephant" {
		t.Error("Elephant not decoded correctly")
	}

	monkey, ok := m.Get("monkey")
	if !ok || monkey.Name != "monkey" {
		t.Error("Monkey not decoded correctly")
	}

	dolphin, ok := m.Get("dolphin")
	if !ok || dolphin.Name != "dolphin" {
		t.Error("Dolphin not decoded correctly")
	}
}

func TestGobEncodeDecodeRoundTrip(t *testing.T) {
	// Create a map with data
	m1 := New[SerializableAnimal]()
	for i := 0; i < 50; i++ {
		m1.Set(strconv.Itoa(i), SerializableAnimal{strconv.Itoa(i)})
	}

	// Encode
	encoded, err := m1.GobEncode()
	if err != nil {
		t.Fatalf("GobEncode failed: %v", err)
	}

	// Decode into a new map
	m2 := New[SerializableAnimal]()
	err = m2.GobDecode(encoded)
	if err != nil {
		t.Fatalf("GobDecode failed: %v", err)
	}

	// Verify counts match
	if m1.Count() != m2.Count() {
		t.Errorf("Count mismatch: original %d, decoded %d", m1.Count(), m2.Count())
	}

	// Verify all elements match
	for i := 0; i < 50; i++ {
		key := strconv.Itoa(i)
		val1, ok1 := m1.Get(key)
		val2, ok2 := m2.Get(key)

		if ok1 != ok2 {
			t.Errorf("Existence mismatch for key %s", key)
		}
		if val1 != val2 {
			t.Errorf("Value mismatch for key %s: original %v, decoded %v", key, val1, val2)
		}
	}
}

func TestGobDecodeIntoUninitializedMap(t *testing.T) {
	// Create test data
	data := map[string]SerializableAnimal{
		"elephant": {"elephant"},
		"monkey":   {"monkey"},
	}
	encoded, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("Failed to create test data: %v", err)
	}

	// Decode into an uninitialized map (no shards)
	var m ConcurrentMap[string, SerializableAnimal]
	err = m.GobDecode(encoded)
	if err != nil {
		t.Errorf("GobDecode into uninitialized map failed: %v", err)
	}

	// Verify the map was properly initialized and populated
	if m.Count() != 2 {
		t.Errorf("Expected 2 elements, got %d", m.Count())
	}

	elephant, ok := m.Get("elephant")
	if !ok || elephant.Name != "elephant" {
		t.Error("Elephant not decoded correctly")
	}

	monkey, ok := m.Get("monkey")
	if !ok || monkey.Name != "monkey" {
		t.Error("Monkey not decoded correctly")
	}
}

func TestGobEncodeEmptyMap(t *testing.T) {
	m := New[SerializableAnimal]()

	// Encode empty map
	encoded, err := m.GobEncode()
	if err != nil {
		t.Errorf("GobEncode of empty map failed: %v", err)
	}

	// Should produce valid JSON for empty map
	var decoded map[string]SerializableAnimal
	err = json.Unmarshal(encoded, &decoded)
	if err != nil {
		t.Errorf("Encoded empty map is not valid JSON: %v", err)
	}

	if len(decoded) != 0 {
		t.Errorf("Expected empty map, got %d elements", len(decoded))
	}
}

func TestGobDecodeEmptyData(t *testing.T) {
	// Empty JSON object
	encoded := []byte("{}")

	m := New[SerializableAnimal]()
	err := m.GobDecode(encoded)
	if err != nil {
		t.Errorf("GobDecode of empty data failed: %v", err)
	}

	if m.Count() != 0 {
		t.Errorf("Expected empty map, got %d elements", m.Count())
	}
}

func TestGobDecodeInvalidData(t *testing.T) {
	// Invalid JSON
	encoded := []byte("invalid json")

	m := New[SerializableAnimal]()
	err := m.GobDecode(encoded)
	if err == nil {
		t.Error("GobDecode should fail with invalid JSON data")
	}
}

func TestGobEncodeDecodeWithIntegers(t *testing.T) {
	// Test with integer values
	m1 := New[int]()
	m1.Set("one", 1)
	m1.Set("two", 2)
	m1.Set("three", 3)

	encoded, err := m1.GobEncode()
	if err != nil {
		t.Fatalf("GobEncode failed: %v", err)
	}

	m2 := New[int]()
	err = m2.GobDecode(encoded)
	if err != nil {
		t.Fatalf("GobDecode failed: %v", err)
	}

	if m1.Count() != m2.Count() {
		t.Errorf("Count mismatch: original %d, decoded %d", m1.Count(), m2.Count())
	}

	for _, key := range []string{"one", "two", "three"} {
		val1, ok1 := m1.Get(key)
		val2, ok2 := m2.Get(key)

		if !ok1 || !ok2 {
			t.Errorf("Key %s missing after decode", key)
		}
		if val1 != val2 {
			t.Errorf("Value mismatch for key %s: original %d, decoded %d", key, val1, val2)
		}
	}
}
