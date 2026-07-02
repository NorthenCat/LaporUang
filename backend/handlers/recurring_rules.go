package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"backend/db"
	"backend/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type RuleWithDetails struct {
	models.RecurringRule
	WalletName   string `json:"wallet_name"`
	CategoryName string `json:"category_name"`
	CategoryIcon string `json:"category_icon"`
}

// GetRecurringRulesHandler retrieves all active recurring rules for the user
func GetRecurringRulesHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	rows, err := db.DB.Query(`
		SELECT r.id, r.user_id, r.wallet_id, r.category_id, r.amount, r.note, r.type, r.frequency, r.start_date, r.end_date, r.next_due_date, r.last_generated_at, r.created_at, r.updated_at,
		       w.name as wallet_name, c.name as category_name, c.icon as category_icon
		FROM recurring_rules r
		JOIN wallets w ON r.wallet_id = w.id
		JOIN categories c ON r.category_id = c.id
		WHERE r.user_id = $1 AND r.deleted_at IS NULL
		ORDER BY r.next_due_date ASC
	`, userID)
	if err != nil {
		http.Error(w, "Database query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	rules := []RuleWithDetails{}
	for rows.Next() {
		var rd RuleWithDetails
		var endDateVal, nextDueVal, lastGenVal sql.NullTime
		var noteVal sql.NullString
		err := rows.Scan(
			&rd.ID, &rd.UserID, &rd.WalletID, &rd.CategoryID, &rd.Amount, &noteVal, &rd.Type, &rd.Frequency, &rd.StartDate, &endDateVal, &nextDueVal, &lastGenVal, &rd.CreatedAt, &rd.UpdatedAt,
			&rd.WalletName, &rd.CategoryName, &rd.CategoryIcon,
		)
		if err != nil {
			http.Error(w, "Scanning error: "+err.Error(), http.StatusInternalServerError)
			return
		}
		if noteVal.Valid {
			rd.Note = &noteVal.String
		}
		if endDateVal.Valid {
			rd.EndDate = &endDateVal.Time
		}
		if nextDueVal.Valid {
			rd.NextDueDate = &nextDueVal.Time
		}
		if lastGenVal.Valid {
			rd.LastGeneratedAt = &lastGenVal.Time
		}
		rules = append(rules, rd)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rules)
}

// CreateRecurringRuleHandler creates a new recurring rule
func CreateRecurringRuleHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	var req models.RecurringRule
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Invalid recurring rule payload", http.StatusBadRequest)
		return
	}

	req.ID = uuid.New().String()
	req.UserID = userID
	req.CreatedAt = time.Now()
	req.UpdatedAt = time.Now()

	// If NextDueDate is not set, set it to StartDate
	if req.NextDueDate == nil || req.NextDueDate.IsZero() {
		req.NextDueDate = &req.StartDate
	}

	_, err = db.DB.Exec(`
		INSERT INTO recurring_rules (id, user_id, wallet_id, category_id, amount, note, type, frequency, start_date, end_date, next_due_date, last_generated_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`, req.ID, req.UserID, req.WalletID, req.CategoryID, req.Amount, req.Note, req.Type, req.Frequency, req.StartDate, req.EndDate, req.NextDueDate, req.LastGeneratedAt, req.CreatedAt, req.UpdatedAt)

	if err != nil {
		http.Error(w, "Database insertion error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(req)
}

// DeleteRecurringRuleHandler soft deletes a recurring rule
func DeleteRecurringRuleHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	ruleID := chi.URLParam(r, "id")
	if ruleID == "" {
		http.Error(w, "Recurring rule ID required", http.StatusBadRequest)
		return
	}

	result, err := db.DB.Exec(`
		UPDATE recurring_rules
		SET deleted_at = $1, updated_at = $1
		WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
	`, time.Now(), ruleID, userID)

	if err != nil {
		http.Error(w, "Database query error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Recurring rule not found or access denied", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Recurring rule deleted successfully", "id": ruleID})
}

// ExecuteRecurringRuleHandler executes a recurring rule: records transaction, adjusts wallet, moves due date
func ExecuteRecurringRuleHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	ruleID := chi.URLParam(r, "id")
	if ruleID == "" {
		http.Error(w, "Recurring rule ID required", http.StatusBadRequest)
		return
	}

	var req struct {
		WalletID      string    `json:"wallet_id"`
		ExecutionDate time.Time `json:"execution_date"`
	}
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		req.ExecutionDate = time.Now()
	}
	if req.ExecutionDate.IsZero() {
		req.ExecutionDate = time.Now()
	}

	// Fetch the recurring rule details
	var rl models.RecurringRule
	var nextDueVal, lastGenVal sql.NullTime
	var noteVal sql.NullString
	err = db.DB.QueryRow(`
		SELECT id, wallet_id, category_id, amount, note, type, frequency, start_date, end_date, next_due_date, last_generated_at
		FROM recurring_rules
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
	`, ruleID, userID).Scan(&rl.ID, &rl.WalletID, &rl.CategoryID, &rl.Amount, &noteVal, &rl.Type, &rl.Frequency, &rl.StartDate, &rl.EndDate, &nextDueVal, &lastGenVal)

	if err == sql.ErrNoRows {
		http.Error(w, "Recurring rule not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Database fetch error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if noteVal.Valid {
		rl.Note = &noteVal.String
	}
	if nextDueVal.Valid {
		rl.NextDueDate = &nextDueVal.Time
	}
	if lastGenVal.Valid {
		rl.LastGeneratedAt = &lastGenVal.Time
	}

	// Prevent double execution in the same period
	if rl.NextDueDate != nil {
		dueDate := *rl.NextDueDate
		nowDate := time.Now()

		if rl.Frequency == "monthly" {
			if dueDate.Year() > nowDate.Year() || (dueDate.Year() == nowDate.Year() && dueDate.Month() > nowDate.Month()) {
				http.Error(w, "Jadwal ini sudah diproses untuk bulan berjalan", http.StatusBadRequest)
				return
			}
		} else if rl.Frequency == "yearly" {
			if dueDate.Year() > nowDate.Year() {
				http.Error(w, "Jadwal ini sudah diproses untuk tahun berjalan", http.StatusBadRequest)
				return
			}
		} else if rl.Frequency == "weekly" || rl.Frequency == "biweekly" || rl.Frequency == "every_other_week" {
			dueZero := time.Date(dueDate.Year(), dueDate.Month(), dueDate.Day(), 0, 0, 0, 0, dueDate.Location())
			nowZero := time.Date(nowDate.Year(), nowDate.Month(), nowDate.Day(), 0, 0, 0, 0, nowDate.Location())
			if dueZero.After(nowZero) {
				http.Error(w, "Jadwal ini sudah diproses untuk periode berjalan", http.StatusBadRequest)
				return
			}
		}
	}

	// If custom wallet is requested, use it, otherwise fall back to rule's wallet
	walletIDToUse := req.WalletID
	if walletIDToUse == "" {
		walletIDToUse = rl.WalletID
	}

	tx, err := db.DB.Begin()
	if err != nil {
		http.Error(w, "Database transaction error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	now := time.Now()
	txnID := uuid.New().String()

	// 1. Reconcile wallet balance
	if rl.Type == "income" {
		_, err = tx.Exec("UPDATE wallets SET balance = balance + $1, updated_at = $2 WHERE id = $3 AND user_id = $4", rl.Amount, now, walletIDToUse, userID)
	} else {
		_, err = tx.Exec("UPDATE wallets SET balance = balance - $1, updated_at = $2 WHERE id = $3 AND user_id = $4", rl.Amount, now, walletIDToUse, userID)
	}
	if err != nil {
		http.Error(w, "Failed to update wallet balance: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. Insert standard transaction
	_, err = tx.Exec(`
		INSERT INTO transactions (id, user_id, wallet_id, category_id, type, amount, date, note, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, txnID, userID, walletIDToUse, rl.CategoryID, rl.Type, rl.Amount, req.ExecutionDate, rl.Note, now, now)
	if err != nil {
		http.Error(w, "Failed to insert transaction log: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 3. Advance next due date of recurring rule
	var nextDueDate *time.Time
	if rl.NextDueDate != nil {
		nextDueDate = rl.NextDueDate
	} else {
		nextDueDate = &rl.StartDate
	}

	var newNextDueDate time.Time
	switch rl.Frequency {
	case "weekly":
		newNextDueDate = nextDueDate.AddDate(0, 0, 7)
	case "biweekly", "every_other_week":
		newNextDueDate = nextDueDate.AddDate(0, 0, 14)
	case "monthly":
		newNextDueDate = nextDueDate.AddDate(0, 1, 0)
	case "yearly":
		newNextDueDate = nextDueDate.AddDate(1, 0, 0)
	default:
		newNextDueDate = nextDueDate.AddDate(0, 1, 0)
	}

	_, err = tx.Exec(`
		UPDATE recurring_rules
		SET next_due_date = $1, last_generated_at = $2, updated_at = $3
		WHERE id = $4
	`, newNextDueDate, now, now, rl.ID)
	if err != nil {
		http.Error(w, "Failed to advance recurring rule next due date: "+err.Error(), http.StatusInternalServerError)
		return
	}

	err = tx.Commit()
	if err != nil {
		http.Error(w, "Commit transaction failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":           "Recurring rule executed successfully",
		"transaction_id":    txnID,
		"new_next_due_date": newNextDueDate,
	})
}
