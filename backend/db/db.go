package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

var DB *sql.DB

// InitDB initializes the database connection and runs migrations
func InitDB() {
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	sslmode := os.Getenv("DB_SSLMODE")

	if host == "" {
		host = "localhost"
	}
	if port == "" {
		port = "5432"
	}
	if user == "" {
		user = "dev"
	}
	if password == "" {
		password = "dev 123"
	}
	if dbname == "" {
		dbname = "laporuang"
	}
	if sslmode == "" {
		sslmode = "disable"
	}

	// Ensure the database exists before connecting to it
	ensureDatabaseExists(host, port, user, password, dbname, sslmode)

	connStr := fmt.Sprintf("host=%s port=%s user=%s password='%s' dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)

	var err error
	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Error opening database: %v", err)
	}

	err = DB.Ping()
	if err != nil {
		log.Fatalf("Error connecting to database (%s): %v", connStr, err)
	}

	log.Println("Successfully connected to PostgreSQL database")

	// Run migrations
	runMigrations()
}

func ensureDatabaseExists(host, port, user, password, dbname, sslmode string) {
	// Connect to default "postgres" database first
	connStr := fmt.Sprintf("host=%s port=%s user=%s password='%s' dbname=postgres sslmode=%s",
		host, port, user, password, sslmode)

	tempDB, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Printf("Warning: Failed to open default 'postgres' database to check target db: %v", err)
		return
	}
	defer tempDB.Close()

	// Check if db exists
	var exists bool
	query := fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = '%s')", dbname)
	err = tempDB.QueryRow(query).Scan(&exists)
	if err != nil {
		log.Printf("Warning: Failed to query pg_database to check target db: %v", err)
		return
	}

	if !exists {
		log.Printf("Database '%s' does not exist. Creating database...", dbname)
		_, err = tempDB.Exec(fmt.Sprintf("CREATE DATABASE %s", dbname))
		if err != nil {
			log.Fatalf("Error creating database '%s': %v", dbname, err)
		}
		log.Printf("Database '%s' created successfully.", dbname)
	}
}

func runMigrations() {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		email VARCHAR(255) UNIQUE NOT NULL,
		password_hash VARCHAR(255) NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS wallets (
		id UUID PRIMARY KEY,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		name VARCHAR(255) NOT NULL,
		balance BIGINT NOT NULL DEFAULT 0,
		type VARCHAR(50) NOT NULL,
		color VARCHAR(50) NOT NULL,
		icon VARCHAR(50) NOT NULL,
		is_archived BOOLEAN NOT NULL DEFAULT FALSE,
		exclude_from_total BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		deleted_at TIMESTAMP WITH TIME ZONE
	);

	CREATE TABLE IF NOT EXISTS categories (
		id UUID PRIMARY KEY,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		name VARCHAR(255) NOT NULL,
		type VARCHAR(50) NOT NULL,
		color VARCHAR(50) NOT NULL,
		icon VARCHAR(50) NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		deleted_at TIMESTAMP WITH TIME ZONE
	);

	CREATE TABLE IF NOT EXISTS transactions (
		id UUID PRIMARY KEY,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
		category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
		type VARCHAR(50) NOT NULL,
		amount BIGINT NOT NULL,
		date TIMESTAMP WITH TIME ZONE NOT NULL,
		note TEXT,
		merchant VARCHAR(255),
		transfer_group_id UUID,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		deleted_at TIMESTAMP WITH TIME ZONE
	);

	CREATE TABLE IF NOT EXISTS transaction_splits (
		id UUID PRIMARY KEY,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
		category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
		amount BIGINT NOT NULL,
		note TEXT,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		deleted_at TIMESTAMP WITH TIME ZONE
	);

	CREATE TABLE IF NOT EXISTS recurring_rules (
		id UUID PRIMARY KEY,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
		category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
		amount BIGINT NOT NULL,
		note TEXT,
		type VARCHAR(50) NOT NULL,
		frequency VARCHAR(50) NOT NULL,
		start_date TIMESTAMP WITH TIME ZONE NOT NULL,
		end_date TIMESTAMP WITH TIME ZONE,
		next_due_date TIMESTAMP WITH TIME ZONE,
		last_generated_at TIMESTAMP WITH TIME ZONE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		deleted_at TIMESTAMP WITH TIME ZONE
	);

	CREATE TABLE IF NOT EXISTS budgets (
		id UUID PRIMARY KEY,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
		amount BIGINT NOT NULL,
		period_start TIMESTAMP WITH TIME ZONE NOT NULL,
		period_end TIMESTAMP WITH TIME ZONE NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		deleted_at TIMESTAMP WITH TIME ZONE
	);

	CREATE TABLE IF NOT EXISTS cashflow_adjustments (
		id UUID PRIMARY KEY,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		date TIMESTAMP WITH TIME ZONE NOT NULL,
		amount BIGINT NOT NULL,
		type VARCHAR(50) NOT NULL,
		note TEXT,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		deleted_at TIMESTAMP WITH TIME ZONE
	);

	CREATE TABLE IF NOT EXISTS attachments (
		id UUID PRIMARY KEY,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
		file_path TEXT NOT NULL,
		file_size BIGINT NOT NULL,
		content_type VARCHAR(255) NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		deleted_at TIMESTAMP WITH TIME ZONE
	);

	CREATE TABLE IF NOT EXISTS tags (
		id UUID PRIMARY KEY,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		name VARCHAR(255) NOT NULL,
		color VARCHAR(50) NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		deleted_at TIMESTAMP WITH TIME ZONE
	);

	CREATE TABLE IF NOT EXISTS transaction_tags (
		id UUID PRIMARY KEY,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
		tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		deleted_at TIMESTAMP WITH TIME ZONE
	);

	CREATE TABLE IF NOT EXISTS ai_providers (
		id UUID PRIMARY KEY,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		name VARCHAR(255) NOT NULL,
		base_url TEXT NOT NULL,
		api_key_encrypted TEXT NOT NULL,
		selected_model VARCHAR(255) NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		deleted_at TIMESTAMP WITH TIME ZONE
	);

	CREATE TABLE IF NOT EXISTS ai_chat_sessions (
		id UUID PRIMARY KEY,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		title VARCHAR(255) NOT NULL,
		last_active_at TIMESTAMP WITH TIME ZONE NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		deleted_at TIMESTAMP WITH TIME ZONE
	);

	CREATE TABLE IF NOT EXISTS ai_messages (
		id UUID PRIMARY KEY,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		session_id UUID REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
		sender VARCHAR(50) NOT NULL,
		content TEXT NOT NULL,
		generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		deleted_at TIMESTAMP WITH TIME ZONE
	);

	CREATE TABLE IF NOT EXISTS user_settings (
		id UUID PRIMARY KEY,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		pin_hash TEXT NOT NULL,
		idle_timeout_seconds INTEGER NOT NULL DEFAULT 300,
		currency_code VARCHAR(10) NOT NULL DEFAULT 'IDR',
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		deleted_at TIMESTAMP WITH TIME ZONE
	);
	`

	_, err := DB.Exec(schema)
	if err != nil {
		log.Fatalf("Error running migrations: %v", err)
	}

	log.Println("PostgreSQL migrations executed successfully")
}
