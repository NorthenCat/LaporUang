package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"backend/db"
	"backend/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type BudgetWithProgress struct {
	models.Budget
	CategoryName   string `json:"category_name"`
	CategoryColor  string `json:"category_color"`
	CategoryIcon   string `json:"category_icon"`
	ActualSpending int64  `json:"actual_spending"`
}

// GetBudgetsHandler retrieves all budgets with their current actual spending progress
func GetBudgetsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	// Fetch budgets
	rows, err := db.DB.Query(`
		SELECT b.id, b.user_id, b.category_id, b.amount, b.period_start, b.period_end, b.created_at, b.updated_at,
		       c.name, c.color, c.icon
		FROM budgets b
		JOIN categories c ON b.category_id = c.id
		WHERE b.user_id = $1 AND b.deleted_at IS NULL
		ORDER BY b.period_start DESC
	`, userID)
	if err != nil {
		http.Error(w, "Database query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	budgets := []BudgetWithProgress{}
	for rows.Next() {
		var bp BudgetWithProgress
		err := rows.Scan(&bp.ID, &bp.UserID, &bp.CategoryID, &bp.Amount, &bp.PeriodStart, &bp.PeriodEnd, &bp.CreatedAt, &bp.UpdatedAt,
			&bp.CategoryName, &bp.CategoryColor, &bp.CategoryIcon)
		if err != nil {
			http.Error(w, "Scanning error", http.StatusInternalServerError)
			return
		}

		// Calculate actual spending for this category in the budget period
		var actual int64
		err = db.DB.QueryRow(`
			SELECT COALESCE(SUM(amount), 0)
			FROM transactions
			WHERE user_id = $1 
			  AND category_id = $2 
			  AND date >= $3 
			  AND date <= $4 
			  AND type = 'expense' 
			  AND deleted_at IS NULL
		`, userID, bp.CategoryID, bp.PeriodStart, bp.PeriodEnd).Scan(&actual)

		if err == nil {
			bp.ActualSpending = actual
		}

		budgets = append(budgets, bp)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(budgets)
}

// CreateBudgetHandler creates a category budget
func CreateBudgetHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	var req models.Budget
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Invalid budget payload", http.StatusBadRequest)
		return
	}

	req.ID = uuid.New().String()
	req.UserID = userID
	req.CreatedAt = time.Now()
	req.UpdatedAt = time.Now()

	_, err = db.DB.Exec(`
		INSERT INTO budgets (id, user_id, category_id, amount, period_start, period_end, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, req.ID, req.UserID, req.CategoryID, req.Amount, req.PeriodStart, req.PeriodEnd, req.CreatedAt, req.UpdatedAt)

	if err != nil {
		http.Error(w, "Database insertion error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(req)
}

// UpdateBudgetHandler updates an existing budget
func UpdateBudgetHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	budgetID := chi.URLParam(r, "id")
	if budgetID == "" {
		http.Error(w, "Budget ID required", http.StatusBadRequest)
		return
	}

	var req models.Budget
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Invalid budget payload", http.StatusBadRequest)
		return
	}

	req.UpdatedAt = time.Now()

	result, err := db.DB.Exec(`
		UPDATE budgets
		SET category_id = $1, amount = $2, period_start = $3, period_end = $4, updated_at = $5
		WHERE id = $6 AND user_id = $7 AND deleted_at IS NULL
	`, req.CategoryID, req.Amount, req.PeriodStart, req.PeriodEnd, req.UpdatedAt, budgetID, userID)

	if err != nil {
		http.Error(w, "Failed to update budget: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Budget not found or access denied", http.StatusNotFound)
		return
	}

	req.ID = budgetID
	req.UserID = userID

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(req)
}

// DeleteBudgetHandler soft deletes a budget
func DeleteBudgetHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	budgetID := chi.URLParam(r, "id")
	if budgetID == "" {
		http.Error(w, "Budget ID required", http.StatusBadRequest)
		return
	}

	result, err := db.DB.Exec(`
		UPDATE budgets
		SET deleted_at = $1, updated_at = $1
		WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
	`, time.Now(), budgetID, userID)

	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Budget not found or access denied", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Budget deleted successfully",
		"id":      budgetID,
	})
}
