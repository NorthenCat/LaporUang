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

// GetCategoriesHandler retrieves all categories of the user
func GetCategoriesHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	rows, err := db.DB.Query(`
		SELECT id, user_id, name, type, color, icon, created_at, updated_at
		FROM categories
		WHERE user_id = $1 AND deleted_at IS NULL
		ORDER BY name ASC
	`, userID)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	categories := []models.Category{}
	for rows.Next() {
		var cat models.Category
		err := rows.Scan(&cat.ID, &cat.UserID, &cat.Name, &cat.Type, &cat.Color, &cat.Icon, &cat.CreatedAt, &cat.UpdatedAt)
		if err != nil {
			http.Error(w, "Row scanning error", http.StatusInternalServerError)
			return
		}
		categories = append(categories, cat)
	}

	// Seed default categories if user doesn't have any
	if len(categories) == 0 {
		categories = seedDefaultCategories(userID)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(categories)
}

// CreateCategoryHandler handles creation of a new category
func CreateCategoryHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	var cat models.Category
	err := json.NewDecoder(r.Body).Decode(&cat)
	if err != nil {
		http.Error(w, "Invalid category schema", http.StatusBadRequest)
		return
	}

	cat.ID = uuid.New().String()
	cat.UserID = userID
	cat.CreatedAt = time.Now()
	cat.UpdatedAt = time.Now()

	_, err = db.DB.Exec(`
		INSERT INTO categories (id, user_id, name, type, color, icon, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, cat.ID, cat.UserID, cat.Name, cat.Type, cat.Color, cat.Icon, cat.CreatedAt, cat.UpdatedAt)

	if err != nil {
		http.Error(w, "Failed to save category: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(cat)
}

// UpdateCategoryHandler handles updating a category
func UpdateCategoryHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	catID := chi.URLParam(r, "id")
	if catID == "" {
		http.Error(w, "Category ID is required", http.StatusBadRequest)
		return
	}

	var cat models.Category
	err := json.NewDecoder(r.Body).Decode(&cat)
	if err != nil {
		http.Error(w, "Invalid category schema", http.StatusBadRequest)
		return
	}

	cat.UpdatedAt = time.Now()

	result, err := db.DB.Exec(`
		UPDATE categories
		SET name = $1, type = $2, color = $3, icon = $4, updated_at = $5
		WHERE id = $6 AND user_id = $7 AND deleted_at IS NULL
	`, cat.Name, cat.Type, cat.Color, cat.Icon, cat.UpdatedAt, catID, userID)

	if err != nil {
		http.Error(w, "Failed to update category: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Category not found or access denied", http.StatusNotFound)
		return
	}

	cat.ID = catID
	cat.UserID = userID

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cat)
}

// DeleteCategoryHandler handles soft-deletion of a category
func DeleteCategoryHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	catID := chi.URLParam(r, "id")
	if catID == "" {
		http.Error(w, "Category ID is required", http.StatusBadRequest)
		return
	}

	result, err := db.DB.Exec(`
		UPDATE categories
		SET deleted_at = $1, updated_at = $1
		WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
	`, time.Now(), catID, userID)

	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Category not found or access denied", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Category deleted successfully",
		"id":      catID,
	})
}

// seedDefaultCategories populates default categories for a new user
func seedDefaultCategories(userID string) []models.Category {
	defaults := []struct {
		Name  string
		Type  string
		Color string
		Icon  string
	}{
		{"Gaji", "income", "#10B981", "TrendingUp"},
		{"Investasi", "income", "#3B82F6", "Briefcase"},
		{"Hibah / Hadiah", "income", "#8B5CF6", "Gift"},
		{"Makanan", "expense", "#EF4444", "Utensils"},
		{"Transportasi", "expense", "#F59E0B", "Car"},
		{"Tagihan / Utilitas", "expense", "#EC4899", "Home"},
		{"Belanja", "expense", "#3B82F6", "ShoppingBag"},
		{"Hiburan", "expense", "#8B5CF6", "Film"},
		{"Kesehatan", "expense", "#10B981", "Heart"},
	}

	categories := []models.Category{}
	for _, item := range defaults {
		cat := models.Category{
			ID:        uuid.New().String(),
			UserID:    userID,
			Name:      item.Name,
			Type:      item.Type,
			Color:     item.Color,
			Icon:      item.Icon,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		_, err := db.DB.Exec(`
			INSERT INTO categories (id, user_id, name, type, color, icon, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, cat.ID, cat.UserID, cat.Name, cat.Type, cat.Color, cat.Icon, cat.CreatedAt, cat.UpdatedAt)

		if err == nil {
			categories = append(categories, cat)
		}
	}
	return categories
}
