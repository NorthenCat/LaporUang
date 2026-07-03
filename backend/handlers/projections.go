package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"backend/db"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type ProjectionPoint struct {
	Date           string   `json:"date"`
	Balance        int64    `json:"balance"`
	Events         []string `json:"events"`
	IsBelowLimit   bool     `json:"is_below_limit"`
}

type ProjectionResponse struct {
	Points              []ProjectionPoint `json:"points"`
	MinBalance          int64             `json:"min_balance"`
	MinBalanceDate      string            `json:"min_balance_date"`
	PotentialDeficitDate string            `json:"potential_deficit_date"` // first date below 0
}

// GetProjectionsHandler projects daily wallet balances based on recurring entries, adjustments and balances
func GetProjectionsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	startDateStr := r.URL.Query().Get("start_date")
	endDateStr := r.URL.Query().Get("end_date")
	walletIDsStr := r.URL.Query().Get("wallet_ids")

	var startDate time.Time
	var err error
	if startDateStr != "" {
		startDate, err = time.Parse(time.RFC3339, startDateStr)
		if err != nil {
			startDate = time.Now()
		}
	} else {
		startDate = time.Now()
	}

	var endDate time.Time
	if endDateStr != "" {
		endDate, err = time.Parse(time.RFC3339, endDateStr)
		if err != nil {
			endDate = startDate.AddDate(0, 0, 30) // default 30 days
		}
	} else {
		endDate = startDate.AddDate(0, 0, 30)
	}

	// Normalize dates to midnight
	startDate = time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, startDate.Location())
	endDate = time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 0, 0, 0, 0, endDate.Location())

	// 1. Fetch current balances of selected wallets
	var balanceQuery string
	var args []interface{}
	args = append(args, userID)

	if walletIDsStr != "" {
		ids := strings.Split(walletIDsStr, ",")
		placeholders := make([]string, len(ids))
		for i, id := range ids {
			placeholders[i] = fmt.Sprintf("$%d", i+2)
			args = append(args, id)
		}
		balanceQuery = "SELECT COALESCE(SUM(balance), 0) FROM wallets WHERE user_id = $1 AND id IN (" + strings.Join(placeholders, ",") + ") AND deleted_at IS NULL"
	} else {
		balanceQuery = "SELECT COALESCE(SUM(balance), 0) FROM wallets WHERE user_id = $1 AND exclude_from_total = FALSE AND deleted_at IS NULL"
	}

	var currentTotalBalance int64
	err = db.DB.QueryRow(balanceQuery, args...).Scan(&currentTotalBalance)
	if err != nil {
		http.Error(w, "Error fetching current balances: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. Fetch recurring rules
	recurringRows, err := db.DB.Query(`
		SELECT r.amount, r.type, r.frequency, r.start_date, r.end_date, r.next_due_date, r.note, c.name
		FROM recurring_rules r
		JOIN categories c ON r.category_id = c.id
		WHERE r.user_id = $1 AND r.deleted_at IS NULL
	`, userID)
	
	type rule struct {
		amount       int64
		flowType     string // income / expense
		frequency    string
		startDate    time.Time
		endDate      *time.Time
		nextDueDate  *time.Time
		note         *string
		categoryName string
	}
	rules := []rule{}
	if err == nil {
		defer recurringRows.Close()
		for recurringRows.Next() {
			var rl rule
			var endDateVal, nextDueVal sql.NullTime
			var noteVal sql.NullString
			if err := recurringRows.Scan(&rl.amount, &rl.flowType, &rl.frequency, &rl.startDate, &endDateVal, &nextDueVal, &noteVal, &rl.categoryName); err == nil {
				if endDateVal.Valid {
					rl.endDate = &endDateVal.Time
				}
				if nextDueVal.Valid {
					rl.nextDueDate = &nextDueVal.Time
				}
				if noteVal.Valid {
					rl.note = &noteVal.String
				}
				rules = append(rules, rl)
			}
		}
	}

	// 3. Fetch manual adjustments within projection range
	adjRows, err := db.DB.Query(`
		SELECT date, amount, type, note
		FROM cashflow_adjustments
		WHERE user_id = $1 AND date >= $2 AND date <= $3 AND deleted_at IS NULL
	`, userID, startDate, endDate)

	type adj struct {
		date   time.Time
		amount int64
		flow   string // add / subtract / set
		note   *string
	}
	adjustments := []adj{}
	if err == nil {
		defer adjRows.Close()
		for adjRows.Next() {
			var ad adj
			var noteVal sql.NullString
			if err := adjRows.Scan(&ad.date, &ad.amount, &ad.flow, &noteVal); err == nil {
				if noteVal.Valid {
					ad.note = &noteVal.String
				}
				// normalize date to midnight
				ad.date = time.Date(ad.date.Year(), ad.date.Month(), ad.date.Day(), 0, 0, 0, 0, ad.date.Location())
				adjustments = append(adjustments, ad)
			}
		}
	}

	// 4. Calculate projection point daily
	response := ProjectionResponse{
		Points:               []ProjectionPoint{},
		MinBalance:           currentTotalBalance,
		MinBalanceDate:       startDate.Format("2006-01-02"),
		PotentialDeficitDate: "",
	}

	runningBalance := currentTotalBalance
	hasDeficit := false

	// Define simulation start date (min of time.Now() and startDate)
	now := time.Now()
	nowNormalized := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	
	simStart := startDate
	if nowNormalized.Before(startDate) {
		simStart = nowNormalized
	}

	// Loop day by day from simStart to endDate
	days := int(endDate.Sub(simStart).Hours()/24) + 1
	for i := 0; i < days; i++ {
		currentDay := simStart.AddDate(0, 0, i)
		currentDayStr := currentDay.Format("2006-01-02")
		dayEvents := []string{}

		// Apply manual adjustments
		for _, ad := range adjustments {
			if ad.date.Equal(currentDay) {
				eventText := "Penyesuaian Manual"
				if ad.note != nil && *ad.note != "" {
					eventText += ": " + *ad.note
				}
				dayEvents = append(dayEvents, eventText)

				if ad.flow == "income" || ad.flow == "add" {
					runningBalance += ad.amount
				} else if ad.flow == "expense" || ad.flow == "subtract" {
					runningBalance -= ad.amount
				} else if ad.flow == "set" {
					runningBalance = ad.amount
				}
			}
		}

		// Apply recurring rules
		// We only apply recurring rules if the date is in the future (after today),
		// because past rules are already reflected in the actual currentTotalBalance in DB.
		if currentDay.After(nowNormalized) {
			for _, rl := range rules {
				// Check if rule fits today
				if isRuleDueOnDate(rl.startDate, rl.endDate, rl.frequency, currentDay) {
					eventText := rl.categoryName
					if rl.note != nil && *rl.note != "" {
						eventText += " (" + *rl.note + ")"
					}
					dayEvents = append(dayEvents, eventText)

					if rl.flowType == "income" {
						runningBalance += rl.amount
					} else {
						runningBalance -= rl.amount
					}
				}
			}
		}

		// Check limits
		if runningBalance < response.MinBalance {
			response.MinBalance = runningBalance
			response.MinBalanceDate = currentDayStr
		}

		if runningBalance < 0 && !hasDeficit {
			response.PotentialDeficitDate = currentDayStr
			hasDeficit = true
		}

		// Only append to response if currentDay is within the requested startDate-endDate range
		if !currentDay.Before(startDate) {
			response.Points = append(response.Points, ProjectionPoint{
				Date:         currentDayStr,
				Balance:      runningBalance,
				Events:       dayEvents,
				IsBelowLimit: runningBalance < 0,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Helper function to check if a recurring rule falls on a specific date
func isRuleDueOnDate(start time.Time, end *time.Time, freq string, checkDate time.Time) bool {
	// standard checks
	if checkDate.Before(start) {
		return false
	}
	if end != nil && checkDate.After(*end) {
		return false
	}

	// Normalize checkDate to midnight
	checkDate = time.Date(checkDate.Year(), checkDate.Month(), checkDate.Day(), 0, 0, 0, 0, checkDate.Location())
	startNorm := time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())

	if checkDate.Equal(startNorm) {
		return true
	}

	switch freq {
	case "weekly":
		days := int(checkDate.Sub(startNorm).Hours() / 24)
		return days%7 == 0
	case "biweekly", "every_other_week":
		days := int(checkDate.Sub(startNorm).Hours() / 24)
		return days%14 == 0
	case "monthly":
		// check day of month matches
		return checkDate.Day() == startNorm.Day()
	case "yearly":
		return checkDate.Day() == startNorm.Day() && checkDate.Month() == startNorm.Month()
	}

	return false
}

// CreateAdjustmentHandler creates a new manual cashflow adjustment
func CreateAdjustmentHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	var req struct {
		Date   time.Time `json:"date"`
		Amount int64     `json:"amount"`
		Type   string    `json:"type"` // income, expense, set
		Note   *string   `json:"note"`
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Invalid adjustment request", http.StatusBadRequest)
		return
	}

	id := uuid.New().String()
	now := time.Now()

	_, err = db.DB.Exec(`
		INSERT INTO cashflow_adjustments (id, user_id, date, amount, type, note, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, id, userID, req.Date, req.Amount, req.Type, req.Note, now, now)

	if err != nil {
		http.Error(w, "Failed to save adjustment: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"id": id, "message": "Adjustment saved successfully"})
}

// GetAdjustmentsHandler lists all manual adjustments for a user
func GetAdjustmentsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	rows, err := db.DB.Query(`
		SELECT id, date, amount, type, note
		FROM cashflow_adjustments
		WHERE user_id = $1 AND deleted_at IS NULL
		ORDER BY date ASC
	`, userID)

	if err != nil {
		http.Error(w, "Database query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type adjustmentResponse struct {
		ID     string    `json:"id"`
		Date   time.Time `json:"date"`
		Amount int64     `json:"amount"`
		Type   string    `json:"type"`
		Note   *string   `json:"note"`
	}

	adjs := []adjustmentResponse{}
	for rows.Next() {
		var a adjustmentResponse
		var noteVal sql.NullString
		if err := rows.Scan(&a.ID, &a.Date, &a.Amount, &a.Type, &noteVal); err == nil {
			if noteVal.Valid {
				a.Note = &noteVal.String
			}
			adjs = append(adjs, a)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(adjs)
}

// DeleteAdjustmentHandler deletes a manual adjustment
func DeleteAdjustmentHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	adjID := chi.URLParam(r, "id")
	if adjID == "" {
		http.Error(w, "Adjustment ID required", http.StatusBadRequest)
		return
	}

	result, err := db.DB.Exec(`
		UPDATE cashflow_adjustments
		SET deleted_at = $1, updated_at = $1
		WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
	`, time.Now(), adjID, userID)

	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Adjustment not found or access denied", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Adjustment deleted successfully"})
}
