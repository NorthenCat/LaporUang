package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"backend/db"
	"backend/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// UploadReceiptHandler handles file uploads and stores them locally on the server
func UploadReceiptHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	// Limit request size to 10MB
	r.ParseMultipartForm(10 << 20)

	file, handler, err := r.FormFile("receipt")
	if err != nil {
		http.Error(w, "Failed to read file from form data", http.StatusBadRequest)
		return
	}
	defer file.Close()

	transactionID := r.FormValue("transaction_id")
	if transactionID == "" {
		http.Error(w, "transaction_id field is required", http.StatusBadRequest)
		return
	}

	uploadsDir := os.Getenv("UPLOADS_DIR")
	if uploadsDir == "" {
		uploadsDir = "./uploads"
	}

	// Create user/transaction specific folders
	userTxFolder := filepath.Join(uploadsDir, userID, transactionID)
	err = os.MkdirAll(userTxFolder, 0755)
	if err != nil {
		http.Error(w, "Failed to create uploads directory", http.StatusInternalServerError)
		return
	}

	// Save file with a unique ID name
	fileID := uuid.New().String()
	ext := filepath.Ext(handler.Filename)
	if ext == "" {
		ext = ".jpg" // default fallback
	}
	destFilename := fileID + ext
	destPath := filepath.Join(userTxFolder, destFilename)

	destFile, err := os.Create(destPath)
	if err != nil {
		http.Error(w, "Failed to write file to local disk", http.StatusInternalServerError)
		return
	}
	defer destFile.Close()

	fileSize, err := io.Copy(destFile, file)
	if err != nil {
		http.Error(w, "Failed to copy file content", http.StatusInternalServerError)
		return
	}

	// Store attachment details in database
	attachmentID := uuid.New().String()
	// Relative path to be stored and served statically
	webPath := filepath.Join("/uploads", userID, transactionID, destFilename)

	_, err = db.DB.Exec(`
		INSERT INTO attachments (id, user_id, transaction_id, file_path, file_size, content_type, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, attachmentID, userID, transactionID, webPath, fileSize, handler.Header.Get("Content-Type"), time.Now(), time.Now())

	if err != nil {
		http.Error(w, "Failed to store attachment in database: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Respond with detail
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.Attachment{
		ID:            attachmentID,
		UserID:        userID,
		TransactionID: transactionID,
		FilePath:      webPath,
		FileSize:      fileSize,
		ContentType:   handler.Header.Get("Content-Type"),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	})
}

// GetTransactionAttachmentHandler retrieves attachment metadata for a transaction
func GetTransactionAttachmentHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	transactionID := chi.URLParam(r, "id")
	if transactionID == "" {
		http.Error(w, "Transaction ID required", http.StatusBadRequest)
		return
	}

	var att models.Attachment
	err := db.DB.QueryRow(`
		SELECT id, user_id, transaction_id, file_path, file_size, content_type, created_at, updated_at
		FROM attachments
		WHERE user_id = $1 AND transaction_id = $2 AND deleted_at IS NULL
		ORDER BY created_at DESC LIMIT 1
	`, userID, transactionID).Scan(
		&att.ID, &att.UserID, &att.TransactionID, &att.FilePath, &att.FileSize, &att.ContentType, &att.CreatedAt, &att.UpdatedAt,
	)

	if err != nil {
		http.Error(w, "Attachment not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(att)
}

// DeleteTransactionAttachmentHandler soft-deletes a transaction's receipt
func DeleteTransactionAttachmentHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	transactionID := chi.URLParam(r, "id")
	if transactionID == "" {
		http.Error(w, "Transaction ID required", http.StatusBadRequest)
		return
	}

	now := time.Now()
	res, err := db.DB.Exec(`
		UPDATE attachments
		SET deleted_at = $1, updated_at = $1
		WHERE user_id = $2 AND transaction_id = $3 AND deleted_at IS NULL
	`, now, userID, transactionID)

	if err != nil {
		http.Error(w, "Failed to delete attachment: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Attachment not found or unauthorized", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
