package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"backend/db"
	"backend/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// GetTransactionsHandler retrieves all transactions with filters
func GetTransactionsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	walletID := r.URL.Query().Get("wallet_id")
	startDateStr := r.URL.Query().Get("start_date")
	endDateStr := r.URL.Query().Get("end_date")

	query := `
		SELECT id, user_id, wallet_id, category_id, type, amount, date, note, merchant, transfer_group_id, created_at, updated_at
		FROM transactions
		WHERE user_id = $1 AND deleted_at IS NULL
	`
	args := []interface{}{userID}
	placeholderIndex := 2

	if walletID != "" {
		query += fmt.Sprintf(" AND wallet_id = $%d", placeholderIndex)
		args = append(args, walletID)
		placeholderIndex++
	}

	if startDateStr != "" {
		if startDate, err := time.Parse(time.RFC3339, startDateStr); err == nil {
			query += fmt.Sprintf(" AND date >= $%d", placeholderIndex)
			args = append(args, startDate)
			placeholderIndex++
		}
	}

	if endDateStr != "" {
		if endDate, err := time.Parse(time.RFC3339, endDateStr); err == nil {
			query += fmt.Sprintf(" AND date <= $%d", placeholderIndex)
			args = append(args, endDate)
			placeholderIndex++
		}
	}

	query += " ORDER BY date DESC, created_at DESC"

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		http.Error(w, "Database query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	transactions := []models.Transaction{}
	for rows.Next() {
		var t models.Transaction
		err := rows.Scan(&t.ID, &t.UserID, &t.WalletID, &t.CategoryID, &t.Type, &t.Amount, &t.Date, &t.Note, &t.Merchant, &t.TransferGroupID, &t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			http.Error(w, "Scanning error: "+err.Error(), http.StatusInternalServerError)
			return
		}
		transactions = append(transactions, t)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transactions)
}

// CreateTransactionHandler handles transaction creation and wallet balance adjustment
func CreateTransactionHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	var req struct {
		WalletID        string    `json:"wallet_id"`
		ToWalletID      string    `json:"to_wallet_id"` // for transfers
		CategoryID      *string   `json:"category_id"`
		Type            string    `json:"type"` // income, expense, transfer, adjustment
		Amount          int64     `json:"amount"`
		Date            time.Time `json:"date"`
		Note            *string   `json:"note"`
		Merchant        *string   `json:"merchant"`
		Splits          []struct {
			CategoryID string  `json:"category_id"`
			Amount     int64   `json:"amount"`
			Note       *string `json:"note"`
		} `json:"splits"`
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Invalid transaction request", http.StatusBadRequest)
		return
	}

	if req.WalletID == "" || req.Amount <= 0 || req.Type == "" {
		http.Error(w, "Missing required fields (wallet_id, amount, type)", http.StatusBadRequest)
		return
	}

	if (req.Type == "income" || req.Type == "expense") && (req.CategoryID == nil || *req.CategoryID == "") {
		http.Error(w, "Category is required for income/expense", http.StatusBadRequest)
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		http.Error(w, "Transaction start error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	txnID := uuid.New().String()
	now := time.Now()

	// Apply balance impacts based on Type
	if req.Type == "income" {
		_, err = tx.Exec("UPDATE wallets SET balance = balance + $1, updated_at = $2 WHERE id = $3 AND user_id = $4", req.Amount, now, req.WalletID, userID)
	} else if req.Type == "expense" {
		_, err = tx.Exec("UPDATE wallets SET balance = balance - $1, updated_at = $2 WHERE id = $3 AND user_id = $4", req.Amount, now, req.WalletID, userID)
	} else if req.Type == "transfer" {
		if req.ToWalletID == "" {
			http.Error(w, "ToWalletID is required for transfers", http.StatusBadRequest)
			return
		}
		// Transfer group ID to link both entries
		tgID := uuid.New().String()

		// Deduct from source
		_, err = tx.Exec("UPDATE wallets SET balance = balance - $1, updated_at = $2 WHERE id = $3 AND user_id = $4", req.Amount, now, req.WalletID, userID)
		if err != nil {
			http.Error(w, "Source wallet update failed", http.StatusInternalServerError)
			return
		}
		// Add to destination
		_, err = tx.Exec("UPDATE wallets SET balance = balance + $1, updated_at = $2 WHERE id = $3 AND user_id = $4", req.Amount, now, req.ToWalletID, userID)
		if err != nil {
			http.Error(w, "Destination wallet update failed", http.StatusInternalServerError)
			return
		}

		// Insert Source Transaction Entry (negative flow)
		_, err = tx.Exec(`
			INSERT INTO transactions (id, user_id, wallet_id, category_id, type, amount, date, note, merchant, transfer_group_id, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`, txnID, userID, req.WalletID, req.CategoryID, "transfer", req.Amount, req.Date, req.Note, req.Merchant, tgID, now, now)
		if err != nil {
			http.Error(w, "Failed to create source transaction: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Insert Destination Transaction Entry (positive flow)
		destTxnID := uuid.New().String()
		destNote := "Diterima dari transfer"
		if req.Note != nil && *req.Note != "" {
			destNote = *req.Note
		}
		_, err = tx.Exec(`
			INSERT INTO transactions (id, user_id, wallet_id, category_id, type, amount, date, note, merchant, transfer_group_id, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`, destTxnID, userID, req.ToWalletID, req.CategoryID, "transfer", req.Amount, req.Date, &destNote, req.Merchant, tgID, now, now)
		if err != nil {
			http.Error(w, "Failed to create destination transaction: "+err.Error(), http.StatusInternalServerError)
			return
		}

		err = tx.Commit()
		if err != nil {
			http.Error(w, "Commit failed", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"message": "Transfer processed successfully", "transfer_group_id": tgID})
		return

	} else if req.Type == "adjustment" {
		// Set balance directly. Create adjustment transaction capturing difference.
		var currentBalance int64
		err = tx.QueryRow("SELECT balance FROM wallets WHERE id = $1 AND user_id = $2", req.WalletID, userID).Scan(&currentBalance)
		if err != nil {
			http.Error(w, "Wallet not found", http.StatusNotFound)
			return
		}

		diff := req.Amount - currentBalance // target balance - current balance
		// We set balance to target
		_, err = tx.Exec("UPDATE wallets SET balance = $1, updated_at = $2 WHERE id = $3 AND user_id = $4", req.Amount, now, req.WalletID, userID)
		if err != nil {
			http.Error(w, "Adjustment update failed", http.StatusInternalServerError)
			return
		}

		// Save adjustment txn with diff amount
		_, err = tx.Exec(`
			INSERT INTO transactions (id, user_id, wallet_id, category_id, type, amount, date, note, merchant, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`, txnID, userID, req.WalletID, req.CategoryID, "adjustment", diff, req.Date, req.Note, req.Merchant, now, now)
		if err != nil {
			http.Error(w, "Adjustment transaction insertion failed: "+err.Error(), http.StatusInternalServerError)
			return
		}

		err = tx.Commit()
		if err != nil {
			http.Error(w, "Commit failed", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"message": "Wallet balance adjusted", "id": txnID})
		return
	}

	if err != nil {
		http.Error(w, "Failed to update wallet balance: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Insert standard transaction
	_, err = tx.Exec(`
		INSERT INTO transactions (id, user_id, wallet_id, category_id, type, amount, date, note, merchant, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, txnID, userID, req.WalletID, req.CategoryID, req.Type, req.Amount, req.Date, req.Note, req.Merchant, now, now)
	if err != nil {
		http.Error(w, "Failed to save transaction: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Save Splits if any
	for _, split := range req.Splits {
		splitID := uuid.New().String()
		_, err = tx.Exec(`
			INSERT INTO transaction_splits (id, user_id, transaction_id, category_id, amount, note, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, splitID, userID, txnID, split.CategoryID, split.Amount, split.Note, now, now)
		if err != nil {
			http.Error(w, "Failed to save split details", http.StatusInternalServerError)
			return
		}
	}

	err = tx.Commit()
	if err != nil {
		http.Error(w, "Commit failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Transaction created successfully", "id": txnID})
}

// DeleteTransactionHandler reverts balance impacts and soft deletes transaction
func DeleteTransactionHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	txnID := chi.URLParam(r, "id")
	if txnID == "" {
		http.Error(w, "Transaction ID is required", http.StatusBadRequest)
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		http.Error(w, "Transaction start error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Fetch transaction to delete
	var txn models.Transaction
	err = tx.QueryRow(`
		SELECT id, wallet_id, type, amount, transfer_group_id
		FROM transactions
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
	`, txnID, userID).Scan(&txn.ID, &txn.WalletID, &txn.Type, &txn.Amount, &txn.TransferGroupID)

	if err == sql.ErrNoRows {
		http.Error(w, "Transaction not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Database query error", http.StatusInternalServerError)
		return
	}

	now := time.Now()

	// Reverse balance impact
	if txn.Type == "income" {
		_, err = tx.Exec("UPDATE wallets SET balance = balance - $1, updated_at = $2 WHERE id = $3", txn.Amount, now, txn.WalletID)
	} else if txn.Type == "expense" {
		_, err = tx.Exec("UPDATE wallets SET balance = balance + $1, updated_at = $2 WHERE id = $3", txn.Amount, now, txn.WalletID)
	} else if txn.Type == "transfer" && txn.TransferGroupID != nil && *txn.TransferGroupID != "" {
		// Revert BOTH transactions linked to the transfer group
		rows, err := tx.Query("SELECT id, wallet_id, amount FROM transactions WHERE transfer_group_id = $1", *txn.TransferGroupID)
		if err == nil {
			type item struct {
				id       string
				walletID string
				amount   int64
			}
			items := []item{}
			for rows.Next() {
				var it item
				if err := rows.Scan(&it.id, &it.walletID, &it.amount); err == nil {
					items = append(items, it)
				}
			}
			rows.Close()

			// Since it's a transfer, one wallet is source (balance reduced), one is dest (balance increased)
			// Wait, which is which? In our creation logic:
			// Source transaction is inserted first with txnID, dest is inserted second.
			// Or we can determine it based on the database:
			// Let's check which is the transaction we clicked to delete:
			// Let's simply:
			// The transaction we clicked is txn.WalletID. It was either source (deducted) or dest (added).
			// If we know both: we can reverse them by checking their original insertion order, OR we can reverse the balance impact of both transaction lines:
			// Wait, instead of guessing, we can look at the two transfer entries.
			// Let's say: the source transaction reduces the source wallet, destination increases dest.
			// How do we know which is source?
			// Let's identify the source and destination wallets.
			// We can lookup both transactions in the database.
			// Let's look up the two transactions:
			if len(items) == 2 {
				// The one created first is the source wallet.
				// Wait! An easier way: since both lines are type = 'transfer' and have positive amount:
				// Let's check which one is the original ID (txnID). The original txnID represents the source wallet (from which money was sent). The other is the dest wallet.
				// So:
				var srcWalletID, destWalletID string
				var amt int64
				for _, it := range items {
					if it.id == txnID {
						srcWalletID = it.walletID
						amt = it.amount
					} else {
						destWalletID = it.walletID
					}
				}

				if srcWalletID != "" && destWalletID != "" {
					// Reverse: Add back to src, deduct from dest
					_, _ = tx.Exec("UPDATE wallets SET balance = balance + $1, updated_at = $2 WHERE id = $3", amt, now, srcWalletID)
					_, _ = tx.Exec("UPDATE wallets SET balance = balance - $1, updated_at = $2 WHERE id = $3", amt, now, destWalletID)
				}
			}
		}

		// Soft delete all transactions in transfer group
		_, err = tx.Exec("UPDATE transactions SET deleted_at = $1, updated_at = $1 WHERE transfer_group_id = $2", now, *txn.TransferGroupID)
		if err != nil {
			http.Error(w, "Failed to delete transfer entries: "+err.Error(), http.StatusInternalServerError)
			return
		}

		err = tx.Commit()
		if err != nil {
			http.Error(w, "Commit failed", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Transfer group transactions deleted"})
		return

	} else if txn.Type == "adjustment" {
		// Adjustment reversal is a bit tricky since the balance was manually set.
		// Reversing it means subtracting the diff amount we logged!
		_, err = tx.Exec("UPDATE wallets SET balance = balance - $1, updated_at = $2 WHERE id = $3", txn.Amount, now, txn.WalletID)
	}

	if err != nil {
		http.Error(w, "Error reversing wallet balance: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Soft delete the single transaction
	_, err = tx.Exec("UPDATE transactions SET deleted_at = $1, updated_at = $1 WHERE id = $2", now, txnID)
	if err != nil {
		http.Error(w, "Database deletion failed", http.StatusInternalServerError)
		return
	}

	// Soft delete transaction splits
	_, _ = tx.Exec("UPDATE transaction_splits SET deleted_at = $1, updated_at = $1 WHERE transaction_id = $2", now, txnID)

	err = tx.Commit()
	if err != nil {
		http.Error(w, "Commit failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Transaction deleted successfully", "id": txnID})
}
