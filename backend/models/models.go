package models

import "time"

type User struct {
	ID           string    `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type Wallet struct {
	ID               string     `json:"id" db:"id"`
	UserID           string     `json:"user_id" db:"user_id"`
	Name             string     `json:"name" db:"name"`
	Balance          int64      `json:"balance" db:"balance"`
	Type             string     `json:"type" db:"type"`
	Color            string     `json:"color" db:"color"`
	Icon             string     `json:"icon" db:"icon"`
	IsArchived       bool       `json:"is_archived" db:"is_archived"`
	ExcludeFromTotal bool       `json:"exclude_from_total" db:"exclude_from_total"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

type Category struct {
	ID        string     `json:"id" db:"id"`
	UserID    string     `json:"user_id" db:"user_id"`
	Name      string     `json:"name" db:"name"`
	Type      string     `json:"type" db:"type"`
	Color     string     `json:"color" db:"color"`
	Icon      string     `json:"icon" db:"icon"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

type Transaction struct {
	ID               string     `json:"id" db:"id"`
	UserID           string     `json:"user_id" db:"user_id"`
	WalletID         string     `json:"wallet_id" db:"wallet_id"`
	CategoryID       *string    `json:"category_id" db:"category_id"`
	Type             string     `json:"type" db:"type"`
	Amount           int64      `json:"amount" db:"amount"`
	Date             time.Time  `json:"date" db:"date"`
	Note             *string    `json:"note,omitempty" db:"note"`
	Merchant         *string    `json:"merchant,omitempty" db:"merchant"`
	TransferGroupID  *string    `json:"transfer_group_id,omitempty" db:"transfer_group_id"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

type TransactionSplit struct {
	ID            string     `json:"id" db:"id"`
	UserID        string     `json:"user_id" db:"user_id"`
	TransactionID string     `json:"transaction_id" db:"transaction_id"`
	CategoryID    string     `json:"category_id" db:"category_id"`
	Amount        int64      `json:"amount" db:"amount"`
	Note          *string    `json:"note,omitempty" db:"note"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt     *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

type RecurringRule struct {
	ID               string     `json:"id" db:"id"`
	UserID           string     `json:"user_id" db:"user_id"`
	WalletID         string     `json:"wallet_id" db:"wallet_id"`
	CategoryID       string     `json:"category_id" db:"category_id"`
	Amount           int64      `json:"amount" db:"amount"`
	Note             *string    `json:"note,omitempty" db:"note"`
	Type             string     `json:"type" db:"type"`
	Frequency        string     `json:"frequency" db:"frequency"`
	StartDate        time.Time  `json:"start_date" db:"start_date"`
	EndDate          *time.Time `json:"end_date,omitempty" db:"end_date"`
	NextDueDate      *time.Time `json:"next_due_date,omitempty" db:"next_due_date"`
	LastGeneratedAt  *time.Time `json:"last_generated_at,omitempty" db:"last_generated_at"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

type Budget struct {
	ID           string     `json:"id" db:"id"`
	UserID       string     `json:"user_id" db:"user_id"`
	CategoryID   string     `json:"category_id" db:"category_id"`
	Amount       int64      `json:"amount" db:"amount"`
	PeriodStart  time.Time  `json:"period_start" db:"period_start"`
	PeriodEnd    time.Time  `json:"period_end" db:"period_end"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt    *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

type CashflowAdjustment struct {
	ID        string     `json:"id" db:"id"`
	UserID    string     `json:"user_id" db:"user_id"`
	Date      time.Time  `json:"date" db:"date"`
	Amount    int64      `json:"amount" db:"amount"`
	Type      string     `json:"type" db:"type"`
	Note      *string    `json:"note,omitempty" db:"note"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

type Attachment struct {
	ID            string     `json:"id" db:"id"`
	UserID        string     `json:"user_id" db:"user_id"`
	TransactionID string     `json:"transaction_id" db:"transaction_id"`
	FilePath      string     `json:"file_path" db:"file_path"`
	FileSize      int64      `json:"file_size" db:"file_size"`
	ContentType   string     `json:"content_type" db:"content_type"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt     *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

type Tag struct {
	ID        string     `json:"id" db:"id"`
	UserID    string     `json:"user_id" db:"user_id"`
	Name      string     `json:"name" db:"name"`
	Color     string     `json:"color" db:"color"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

type TransactionTag struct {
	ID            string     `json:"id" db:"id"`
	UserID        string     `json:"user_id" db:"user_id"`
	TransactionID string     `json:"transaction_id" db:"transaction_id"`
	TagID         string     `json:"tag_id" db:"tag_id"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt     *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

type AIProvider struct {
	ID               string     `json:"id" db:"id"`
	UserID           string     `json:"user_id" db:"user_id"`
	Name             string     `json:"name" db:"name"`
	BaseURL          string     `json:"base_url" db:"base_url"`
	APIKeyEncrypted  string     `json:"api_key_encrypted" db:"api_key_encrypted"`
	SelectedModel    string     `json:"selected_model" db:"selected_model"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

type AIChatSession struct {
	ID           string     `json:"id" db:"id"`
	UserID       string     `json:"user_id" db:"user_id"`
	Title        string     `json:"title" db:"title"`
	LastActiveAt time.Time  `json:"last_active_at" db:"last_active_at"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt    *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

type AIMessage struct {
	ID          string     `json:"id" db:"id"`
	UserID      string     `json:"user_id" db:"user_id"`
	SessionID   string     `json:"session_id" db:"session_id"`
	Sender      string     `json:"sender" db:"sender"`
	Content     string     `json:"content" db:"content"`
	GeneratedAt time.Time  `json:"generated_at" db:"generated_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt   *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

type UserSetting struct {
	ID                  string     `json:"id" db:"id"`
	UserID              string     `json:"user_id" db:"user_id"`
	PINHash             string     `json:"pin_hash" db:"pin_hash"`
	IdleTimeoutSeconds  int        `json:"idle_timeout_seconds" db:"idle_timeout_seconds"`
	CurrencyCode        string     `json:"currency_code" db:"currency_code"`
	CreatedAt           time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt           *time.Time `json:"deleted_at,omitempty" db:"deleted_at"`
}

// SyncPushPayload is the structure of incoming push synchronization
type SyncPushPayload struct {
	Wallets             []Wallet             `json:"wallets"`
	Categories          []Category           `json:"categories"`
	Transactions        []Transaction        `json:"transactions"`
	TransactionSplits   []TransactionSplit   `json:"transaction_splits"`
	RecurringRules      []RecurringRule      `json:"recurring_rules"`
	Budgets             []Budget             `json:"budgets"`
	CashflowAdjustments []CashflowAdjustment `json:"cashflow_adjustments"`
	Attachments         []Attachment         `json:"attachments"`
	Tags                []Tag                `json:"tags"`
	TransactionTags     []TransactionTag     `json:"transaction_tags"`
	AIProviders         []AIProvider         `json:"ai_providers"`
	AIChatSessions      []AIChatSession      `json:"ai_chat_sessions"`
	AIMessages          []AIMessage          `json:"ai_messages"`
	UserSettings        []UserSetting        `json:"user_settings"`
}

// SyncPushResponse returns the synced entity IDs
type SyncPushResponse struct {
	SuccessIDs []string  `json:"success_ids"`
	ServerTime time.Time `json:"server_time"`
}

// SyncPullResponse returns all remote changes for the user
type SyncPullResponse struct {
	Wallets             []Wallet             `json:"wallets"`
	Categories          []Category           `json:"categories"`
	Transactions        []Transaction        `json:"transactions"`
	TransactionSplits   []TransactionSplit   `json:"transaction_splits"`
	RecurringRules      []RecurringRule      `json:"recurring_rules"`
	Budgets             []Budget             `json:"budgets"`
	CashflowAdjustments []CashflowAdjustment `json:"cashflow_adjustments"`
	Attachments         []Attachment         `json:"attachments"`
	Tags                []Tag                `json:"tags"`
	TransactionTags     []TransactionTag     `json:"transaction_tags"`
	AIProviders         []AIProvider         `json:"ai_providers"`
	AIChatSessions      []AIChatSession      `json:"ai_chat_sessions"`
	AIMessages          []AIMessage          `json:"ai_messages"`
	UserSettings        []UserSetting        `json:"user_settings"`
	ServerTime          time.Time            `json:"server_time"`
}
