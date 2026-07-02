package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"backend/db"
	"backend/models"

	"github.com/google/uuid"
)

type SettingsResponse struct {
	IdleTimeoutSeconds int    `json:"idle_timeout_seconds"`
	CurrencyCode       string `json:"currency_code"`
	PINEnabled         bool   `json:"pin_enabled"`
}

// GetSettingsHandler retrieves user settings
func GetSettingsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	var setting models.UserSetting
	err := db.DB.QueryRow(`
		SELECT pin_hash, idle_timeout_seconds, currency_code
		FROM user_settings
		WHERE user_id = $1 AND deleted_at IS NULL
	`, userID).Scan(&setting.PINHash, &setting.IdleTimeoutSeconds, &setting.CurrencyCode)

	if err == sql.ErrNoRows {
		// Return default settings
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(SettingsResponse{
			IdleTimeoutSeconds: 300,
			CurrencyCode:       "IDR",
			PINEnabled:         false,
		})
		return
	} else if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SettingsResponse{
		IdleTimeoutSeconds: setting.IdleTimeoutSeconds,
		CurrencyCode:       setting.CurrencyCode,
		PINEnabled:         setting.PINHash != "",
	})
}

// SaveSettingsHandler creates or updates user settings
func SaveSettingsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	var req struct {
		IdleTimeoutSeconds int     `json:"idle_timeout_seconds"`
		CurrencyCode       string  `json:"currency_code"`
		PINHash            *string `json:"pin_hash"` // If nil, keep existing. If empty string "", disable PIN.
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Invalid settings request", http.StatusBadRequest)
		return
	}

	if req.IdleTimeoutSeconds <= 0 {
		req.IdleTimeoutSeconds = 300
	}
	if req.CurrencyCode == "" {
		req.CurrencyCode = "IDR"
	}

	now := time.Now()

	// Check if settings exist
	var existingID string
	var existingPINHash string
	err = db.DB.QueryRow("SELECT id, pin_hash FROM user_settings WHERE user_id = $1 AND deleted_at IS NULL", userID).Scan(&existingID, &existingPINHash)

	if err == sql.ErrNoRows {
		// Insert new settings
		newID := uuid.New().String()
		pinVal := ""
		if req.PINHash != nil {
			pinVal = *req.PINHash
		}

		_, err = db.DB.Exec(`
			INSERT INTO user_settings (id, user_id, pin_hash, idle_timeout_seconds, currency_code, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, newID, userID, pinVal, req.IdleTimeoutSeconds, req.CurrencyCode, now, now)

		if err != nil {
			http.Error(w, "Failed to save settings: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(SettingsResponse{
			IdleTimeoutSeconds: req.IdleTimeoutSeconds,
			CurrencyCode:       req.CurrencyCode,
			PINEnabled:         pinVal != "",
		})
		return
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Update existing settings
	targetPINHash := existingPINHash
	if req.PINHash != nil {
		targetPINHash = *req.PINHash
	}

	_, err = db.DB.Exec(`
		UPDATE user_settings
		SET pin_hash = $1, idle_timeout_seconds = $2, currency_code = $3, updated_at = $4
		WHERE id = $5
	`, targetPINHash, req.IdleTimeoutSeconds, req.CurrencyCode, now, existingID)

	if err != nil {
		http.Error(w, "Failed to update settings: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SettingsResponse{
		IdleTimeoutSeconds: req.IdleTimeoutSeconds,
		CurrencyCode:       req.CurrencyCode,
		PINEnabled:         targetPINHash != "",
	})
}

// VerifyPINHandler checks if the entered PIN matches the saved PIN hash
func VerifyPINHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	var req struct {
		PINHash string `json:"pin_hash"`
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Invalid verify PIN request", http.StatusBadRequest)
		return
	}

	var savedHash string
	err = db.DB.QueryRow("SELECT pin_hash FROM user_settings WHERE user_id = $1 AND deleted_at IS NULL", userID).Scan(&savedHash)
	if err == sql.ErrNoRows || savedHash == "" {
		// PIN is not set, allow access
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"valid": true})
		return
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	valid := savedHash == req.PINHash

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"valid": valid})
}
