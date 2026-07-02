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

// GetWalletsHandler retrieves all wallets of the user
func GetWalletsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	rows, err := db.DB.Query(`
		SELECT id, user_id, name, balance, type, color, icon, is_archived, exclude_from_total, created_at, updated_at
		FROM wallets
		WHERE user_id = $1 AND deleted_at IS NULL
		ORDER BY name ASC
	`, userID)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	wallets := []models.Wallet{}
	for rows.Next() {
		var wl models.Wallet
		err := rows.Scan(&wl.ID, &wl.UserID, &wl.Name, &wl.Balance, &wl.Type, &wl.Color, &wl.Icon, &wl.IsArchived, &wl.ExcludeFromTotal, &wl.CreatedAt, &wl.UpdatedAt)
		if err != nil {
			http.Error(w, "Row scanning error", http.StatusInternalServerError)
			return
		}
		wallets = append(wallets, wl)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(wallets)
}

// CreateWalletHandler handles creation of a new wallet
func CreateWalletHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	var wl models.Wallet
	err := json.NewDecoder(r.Body).Decode(&wl)
	if err != nil {
		http.Error(w, "Invalid wallet schema", http.StatusBadRequest)
		return
	}

	wl.ID = uuid.New().String()
	wl.UserID = userID
	wl.CreatedAt = time.Now()
	wl.UpdatedAt = time.Now()

	_, err = db.DB.Exec(`
		INSERT INTO wallets (id, user_id, name, balance, type, color, icon, is_archived, exclude_from_total, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, wl.ID, wl.UserID, wl.Name, wl.Balance, wl.Type, wl.Color, wl.Icon, wl.IsArchived, wl.ExcludeFromTotal, wl.CreatedAt, wl.UpdatedAt)

	if err != nil {
		http.Error(w, "Failed to save wallet: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(wl)
}

// UpdateWalletHandler handles updating a wallet
func UpdateWalletHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	walletID := chi.URLParam(r, "id")
	if walletID == "" {
		http.Error(w, "Wallet ID is required", http.StatusBadRequest)
		return
	}

	var wl models.Wallet
	err := json.NewDecoder(r.Body).Decode(&wl)
	if err != nil {
		http.Error(w, "Invalid wallet schema", http.StatusBadRequest)
		return
	}

	wl.UpdatedAt = time.Now()

	result, err := db.DB.Exec(`
		UPDATE wallets
		SET name = $1, balance = $2, type = $3, color = $4, icon = $5, is_archived = $6, exclude_from_total = $7, updated_at = $8
		WHERE id = $9 AND user_id = $10 AND deleted_at IS NULL
	`, wl.Name, wl.Balance, wl.Type, wl.Color, wl.Icon, wl.IsArchived, wl.ExcludeFromTotal, wl.UpdatedAt, walletID, userID)

	if err != nil {
		http.Error(w, "Failed to update wallet: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Wallet not found or access denied", http.StatusNotFound)
		return
	}

	wl.ID = walletID
	wl.UserID = userID

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(wl)
}

// DeleteWalletHandler soft-deletes (tombstones) or hard-deletes a wallet based on preferences
func DeleteWalletHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	walletID := chi.URLParam(r, "id")
	if walletID == "" {
		http.Error(w, "Wallet ID is required", http.StatusBadRequest)
		return
	}

	// Direct soft-delete
	result, err := db.DB.Exec(`
		UPDATE wallets
		SET deleted_at = $1, updated_at = $1
		WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
	`, time.Now(), walletID, userID)

	if err != nil {
		http.Error(w, "Database deletion error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Wallet not found or access denied", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Wallet deleted successfully",
		"id":      walletID,
	})
}
