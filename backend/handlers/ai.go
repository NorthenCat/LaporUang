package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"backend/db"
	"backend/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// ConfigureAIProviderHandler saves/updates the user's AI endpoint configs
func ConfigureAIProviderHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	var req struct {
		Name          string `json:"name"`
		BaseURL       string `json:"base_url"`
		APIKey        string `json:"api_key"`
		SelectedModel string `json:"selected_model"`
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Invalid AI provider config payload", http.StatusBadRequest)
		return
	}

	now := time.Now()

	// Check if already exists
	var id string
	err = db.DB.QueryRow("SELECT id FROM ai_providers WHERE user_id = $1 AND deleted_at IS NULL", userID).Scan(&id)

	if err == sql.ErrNoRows {
		newID := uuid.New().String()
		_, err = db.DB.Exec(`
			INSERT INTO ai_providers (id, user_id, name, base_url, api_key_encrypted, selected_model, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, newID, userID, req.Name, req.BaseURL, req.APIKey, req.SelectedModel, now, now)
	} else if err == nil {
		_, err = db.DB.Exec(`
			UPDATE ai_providers
			SET name = $1, base_url = $2, api_key_encrypted = $3, selected_model = $4, updated_at = $5
			WHERE id = $6
		`, req.Name, req.BaseURL, req.APIKey, req.SelectedModel, now, id)
	}

	if err != nil {
		http.Error(w, "Failed to save AI configuration: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "AI settings updated successfully"})
}

// GetAIProviderHandler retrieves AI configuration (with masked api key)
func GetAIProviderHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	var prov models.AIProvider
	err := db.DB.QueryRow(`
		SELECT name, base_url, api_key_encrypted, selected_model
		FROM ai_providers
		WHERE user_id = $1 AND deleted_at IS NULL
	`, userID).Scan(&prov.Name, &prov.BaseURL, &prov.APIKeyEncrypted, &prov.SelectedModel)

	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"name":           "",
			"base_url":       "",
			"selected_model": "",
			"has_key":        false,
		})
		return
	} else if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	maskedKey := ""
	if len(prov.APIKeyEncrypted) > 8 {
		maskedKey = prov.APIKeyEncrypted[:4] + "..." + prov.APIKeyEncrypted[len(prov.APIKeyEncrypted)-4:]
	} else if prov.APIKeyEncrypted != "" {
		maskedKey = "..."
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"name":           prov.Name,
		"base_url":       prov.BaseURL,
		"selected_model": prov.SelectedModel,
		"has_key":        prov.APIKeyEncrypted != "",
		"masked_key":     maskedKey,
	})
}

// GetAIModelsHandler fetches lists of models from the user's custom OpenAI-compatible endpoint
func GetAIModelsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	var baseURL, apiKey string
	err := db.DB.QueryRow("SELECT base_url, api_key_encrypted FROM ai_providers WHERE user_id = $1 AND deleted_at IS NULL", userID).Scan(&baseURL, &apiKey)
	if err == sql.ErrNoRows || baseURL == "" {
		http.Error(w, "AI Provider not configured", http.StatusBadRequest)
		return
	} else if err != nil {
		http.Error(w, "Database query error", http.StatusInternalServerError)
		return
	}

	// Request models from endpoint
	url := fmt.Sprintf("%s/models", baseURL)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		http.Error(w, "Failed to create request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if apiKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "Failed to contact AI endpoint: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// GetAIChatSessionsHandler lists chat sessions
func GetAIChatSessionsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	rows, err := db.DB.Query(`
		SELECT id, user_id, title, last_active_at, created_at, updated_at
		FROM ai_chat_sessions
		WHERE user_id = $1 AND deleted_at IS NULL
		ORDER BY last_active_at DESC
	`, userID)
	if err != nil {
		http.Error(w, "Database query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	sessions := []models.AIChatSession{}
	for rows.Next() {
		var s models.AIChatSession
		err := rows.Scan(&s.ID, &s.UserID, &s.Title, &s.LastActiveAt, &s.CreatedAt, &s.UpdatedAt)
		if err == nil {
			sessions = append(sessions, s)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

// CreateAIChatSessionHandler creates a new chat session
func CreateAIChatSessionHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	var req struct {
		Title string `json:"title"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	if req.Title == "" {
		req.Title = "Obrolan Keuangan Baru"
	}

	sessionID := uuid.New().String()
	now := time.Now()

	_, err := db.DB.Exec(`
		INSERT INTO ai_chat_sessions (id, user_id, title, last_active_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, sessionID, userID, req.Title, now, now, now)

	if err != nil {
		http.Error(w, "Failed to create chat session: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"id":    sessionID,
		"title": req.Title,
	})
}

// GetAIMessagesHandler gets messages in a session
func GetAIMessagesHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	sessionID := chi.URLParam(r, "sessionId")
	if sessionID == "" {
		http.Error(w, "Session ID required", http.StatusBadRequest)
		return
	}

	rows, err := db.DB.Query(`
		SELECT id, user_id, session_id, sender, content, generated_at
		FROM ai_messages
		WHERE session_id = $1 AND user_id = $2 AND deleted_at IS NULL
		ORDER BY generated_at ASC
	`, sessionID, userID)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	messages := []models.AIMessage{}
	for rows.Next() {
		var m models.AIMessage
		err := rows.Scan(&m.ID, &m.UserID, &m.SessionID, &m.Sender, &m.Content, &m.GeneratedAt)
		if err == nil {
			messages = append(messages, m)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// SendAIMessageHandler proxies chat request to AI and saves history
func SendAIMessageHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "Unauthorized session", http.StatusUnauthorized)
		return
	}

	sessionID := chi.URLParam(r, "sessionId")
	if sessionID == "" {
		http.Error(w, "Session ID required", http.StatusBadRequest)
		return
	}

	var req struct {
		Message string `json:"message"`
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil || req.Message == "" {
		http.Error(w, "Message is required", http.StatusBadRequest)
		return
	}

	// 1. Fetch AI config
	var baseURL, apiKey, model string
	err = db.DB.QueryRow(`
		SELECT base_url, api_key_encrypted, selected_model
		FROM ai_providers
		WHERE user_id = $1 AND deleted_at IS NULL
	`, userID).Scan(&baseURL, &apiKey, &model)
	if err == sql.ErrNoRows || baseURL == "" {
		http.Error(w, "AI settings not configured yet", http.StatusBadRequest)
		return
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// 2. Fetch recent transaction/wallet summaries to feed to the AI prompt context
	summaryText := generateFinancialSummaryContext(userID)

	// 3. Save user message to database
	userMsgID := uuid.New().String()
	now := time.Now()
	_, err = db.DB.Exec(`
		INSERT INTO ai_messages (id, user_id, session_id, sender, content, generated_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, userMsgID, userID, sessionID, "user", req.Message, now, now, now)
	if err != nil {
		http.Error(w, "Failed to save user message", http.StatusInternalServerError)
		return
	}

	// Fetch previous chat history in this session
	historyRows, err := db.DB.Query(`
		SELECT sender, content
		FROM ai_messages
		WHERE session_id = $1 AND user_id = $2 AND deleted_at IS NULL
		ORDER BY generated_at ASC
		LIMIT 15
	`, sessionID, userID)

	type openAIMessage struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	openAIMessages := []openAIMessage{}

	// System Prompt
	systemContent := fmt.Sprintf(`Anda adalah LaporUang AI Assistant, asisten keuangan pribadi cerdas dan ramah.
Tugas Anda adalah membantu pengguna menganalisis keuangan mereka, memberikan rekomendasi berhemat, mendeteksi anomali, merencanakan budget, dan memberikan insight bermanfaat.

Berikut adalah Ringkasan Finansial Pengguna terkini untuk referensi Anda (mohon dijaga kerahasiaannya dan gunakan hanya untuk analisis):
%s

Harap bersikap profesional, beri saran yang taktis, gunakan mata uang Rupiah (Rp) jika membicarakan uang, dan tanggapi dalam Bahasa Indonesia yang baik dan mudah dimengerti.`, summaryText)

	openAIMessages = append(openAIMessages, openAIMessage{
		Role:    "system",
		Content: systemContent,
	})

	if err == nil {
		defer historyRows.Close()
		for historyRows.Next() {
			var sender, content string
			if err := historyRows.Scan(&sender, &content); err == nil {
				role := "user"
				if sender == "ai" {
					role = "assistant"
				}
				openAIMessages = append(openAIMessages, openAIMessage{Role: role, Content: content})
			}
		}
	}

	// Add current message if not already added
	// (it was saved to DB, history query might include or exclude depending on query timing, let's build the request carefully)
	// If the history query returned empty or didn't fetch it, append it manually
	if len(openAIMessages) == 1 { // only system prompt
		openAIMessages = append(openAIMessages, openAIMessage{Role: "user", Content: req.Message})
	}

	// 4. Construct request to OpenAI-compatible endpoint
	reqBodyObj := map[string]interface{}{
		"model":       model,
		"messages":    openAIMessages,
		"temperature": 0.7,
	}
	jsonBytes, _ := json.Marshal(reqBodyObj)

	aiURL := fmt.Sprintf("%s/chat/completions", baseURL)
	aiReq, err := http.NewRequest("POST", aiURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		http.Error(w, "Failed to construct AI request: "+err.Error(), http.StatusInternalServerError)
		return
	}
	aiReq.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		aiReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
	}

	client := &http.Client{Timeout: 30 * time.Second}
	aiResp, err := client.Do(aiReq)
	if err != nil {
		http.Error(w, "Failed to contact AI endpoint: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer aiResp.Body.Close()

	if aiResp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(aiResp.Body)
		http.Error(w, fmt.Sprintf("AI provider returned error code %d: %s", aiResp.StatusCode, string(bodyBytes)), http.StatusBadGateway)
		return
	}

	// 5. Parse AI Response
	var aiRespBody struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	// We decode from aiResp.Body
	bodyBytes, err := io.ReadAll(aiResp.Body)
	if err != nil {
		http.Error(w, "Failed to read response from AI service", http.StatusInternalServerError)
		return
	}
	
	err = json.Unmarshal(bodyBytes, &aiRespBody)
	if err != nil || len(aiRespBody.Choices) == 0 {
		http.Error(w, "Failed to parse AI completion details: "+err.Error(), http.StatusInternalServerError)
		return
	}

	aiContent := aiRespBody.Choices[0].Message.Content

	// 6. Save AI reply to database
	aiMsgID := uuid.New().String()
	aiTime := time.Now()
	_, err = db.DB.Exec(`
		INSERT INTO ai_messages (id, user_id, session_id, sender, content, generated_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, aiMsgID, userID, sessionID, "ai", aiContent, aiTime, aiTime, aiTime)

	// Update last_active_at of session
	_, _ = db.DB.Exec("UPDATE ai_chat_sessions SET last_active_at = $1, updated_at = $1 WHERE id = $2", aiTime, sessionID)

	// 7. Return AI message reply to UI
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.AIMessage{
		ID:          aiMsgID,
		UserID:      userID,
		SessionID:   sessionID,
		Sender:      "ai",
		Content:     aiContent,
		GeneratedAt: aiTime,
		CreatedAt:   aiTime,
		UpdatedAt:   aiTime,
	})
}

// generateFinancialSummaryContext compiles general metrics of the user into a text block for prompt priming
func generateFinancialSummaryContext(userID string) string {
	// Query non-archived wallets total
	var totalBalance int64
	db.DB.QueryRow("SELECT COALESCE(SUM(balance), 0) FROM wallets WHERE user_id = $1 AND exclude_from_total = FALSE AND deleted_at IS NULL", userID).Scan(&totalBalance)

	// Query wallets breakdown
	walletLines := []string{}
	rows, err := db.DB.Query("SELECT name, balance, type FROM wallets WHERE user_id = $1 AND deleted_at IS NULL", userID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var name, wType string
			var balance int64
			if err := rows.Scan(&name, &balance, &wType); err == nil {
				walletLines = append(walletLines, fmt.Sprintf("- %s (%s): Rp %d", name, wType, balance))
			}
		}
	}

	// Query top categories expenditure in the last 30 days
	categoryLines := []string{}
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)
	cRows, err := db.DB.Query(`
		SELECT c.name, SUM(t.amount) as total
		FROM transactions t
		JOIN categories c ON t.category_id = c.id
		WHERE t.user_id = $1 AND t.type = 'expense' AND t.date >= $2 AND t.deleted_at IS NULL
		GROUP BY c.name
		ORDER BY total DESC
		LIMIT 5
	`, userID, thirtyDaysAgo)
	if err == nil {
		defer cRows.Close()
		for cRows.Next() {
			var name string
			var total int64
			if err := cRows.Scan(&name, &total); err == nil {
				categoryLines = append(categoryLines, fmt.Sprintf("- %s: Rp %d", name, total))
			}
		}
	}

	summary := fmt.Sprintf(`Total Saldo Gabungan: Rp %d
Daftar Dompet:
%s

Top Pengeluaran 30 Hari Terakhir berdasarkan Kategori:
%s`, totalBalance, strings.Join(walletLines, "\n"), strings.Join(categoryLines, "\n"))

	return summary
}
