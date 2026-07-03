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

// UpdateAIChatSessionHandler renames a chat session
func UpdateAIChatSessionHandler(w http.ResponseWriter, r *http.Request) {
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
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Title == "" {
		http.Error(w, "Valid title is required", http.StatusBadRequest)
		return
	}

	now := time.Now()
	res, err := db.DB.Exec(`
		UPDATE ai_chat_sessions
		SET title = $1, updated_at = $2
		WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL
	`, req.Title, now, sessionID, userID)

	if err != nil {
		http.Error(w, "Failed to update session: "+err.Error(), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Session not found or unauthorized", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
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

// ---------------------- AI TOOLS DEFS ----------------------

type openAIToolCallFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}
type openAIToolCall struct {
	Id       string                 `json:"id"`
	Type     string                 `json:"type"`
	Function openAIToolCallFunction `json:"function"`
}
type openAIMessage struct {
	Role       string           `json:"role"`
	Content    *string          `json:"content,omitempty"`
	ToolCalls  []openAIToolCall `json:"tool_calls,omitempty"`
	ToolCallId string           `json:"tool_call_id,omitempty"`
}

type functionProperty struct {
	Type        string `json:"type"`
	Description string `json:"description"`
}
type functionParameters struct {
	Type       string                      `json:"type"`
	Properties map[string]functionProperty `json:"properties"`
	Required   []string                    `json:"required,omitempty"`
}
type functionDefinition struct {
	Name        string             `json:"name"`
	Description string             `json:"description"`
	Parameters  functionParameters `json:"parameters"`
}
type toolDefinition struct {
	Type     string             `json:"type"`
	Function functionDefinition `json:"function"`
}

func getAIAvailableTools() []toolDefinition {
	return []toolDefinition{
		{
			Type: "function",
			Function: functionDefinition{
				Name:        "get_wallets_balance",
				Description: "Mengambil daftar seluruh dompet (rekening, e-wallet, tunai) pengguna beserta saldo terkininya.",
				Parameters: functionParameters{
					Type:       "object",
					Properties: map[string]functionProperty{},
				},
			},
		},
		{
			Type: "function",
			Function: functionDefinition{
				Name:        "get_recent_transactions",
				Description: "Mengambil riwayat transaksi terbaru pengguna. Bisa digunakan untuk melihat kemana saja uang dibelanjakan atau dari mana uang masuk.",
				Parameters: functionParameters{
					Type: "object",
					Properties: map[string]functionProperty{
						"limit": {
							Type:        "integer",
							Description: "Jumlah maksimum transaksi yang ingin diambil (default: 10, max: 50).",
						},
						"type": {
							Type:        "string",
							Description: "Filter berdasarkan tipe transaksi. Pilihan: 'income', 'expense', 'transfer'. Kosongkan untuk melihat semua tipe.",
						},
					},
				},
			},
		},
		{
			Type: "function",
			Function: functionDefinition{
				Name:        "get_recurring_rules",
				Description: "Mengambil daftar tagihan rutin (pengeluaran) atau pendapatan rutin pengguna beserta jadwal tanggal cair/jatuh temponya.",
				Parameters: functionParameters{
					Type:       "object",
					Properties: map[string]functionProperty{},
				},
			},
		},
	}
}

func executeAITool(userID, toolName, arguments string) string {
	switch toolName {
	case "get_wallets_balance":
		rows, err := db.DB.Query("SELECT name, balance, type FROM wallets WHERE user_id = $1 AND deleted_at IS NULL", userID)
		if err != nil {
			return `{"error": "Failed to query database"}`
		}
		defer rows.Close()
		type w struct {
			Name    string `json:"name"`
			Balance int64  `json:"balance"`
			Type    string `json:"type"`
		}
		var ws []w
		for rows.Next() {
			var w1 w
			rows.Scan(&w1.Name, &w1.Balance, &w1.Type)
			ws = append(ws, w1)
		}
		b, _ := json.Marshal(ws)
		return string(b)

	case "get_recent_transactions":
		var args struct {
			Limit int    `json:"limit"`
			Type  string `json:"type"`
		}
		json.Unmarshal([]byte(arguments), &args)
		limit := 10
		if args.Limit > 0 && args.Limit <= 50 {
			limit = args.Limit
		}

		query := `SELECT t.amount, t.type, t.date, t.note, c.name as category_name, w.name as wallet_name 
				  FROM transactions t 
				  LEFT JOIN categories c ON t.category_id = c.id 
				  LEFT JOIN wallets w ON t.wallet_id = w.id
				  WHERE t.user_id = $1 AND t.deleted_at IS NULL`
		argsList := []interface{}{userID}
		if args.Type == "income" || args.Type == "expense" || args.Type == "transfer" {
			query += ` AND t.type = $2`
			argsList = append(argsList, args.Type)
		}
		query += fmt.Sprintf(` ORDER BY t.date DESC LIMIT %d`, limit)

		rows, err := db.DB.Query(query, argsList...)
		if err != nil {
			return `{"error": "Failed to query database"}`
		}
		defer rows.Close()
		type tx struct {
			Amount       int64  `json:"amount"`
			Type         string `json:"type"`
			Date         string `json:"date"`
			Note         string `json:"note"`
			CategoryName string `json:"category_name"`
			WalletName   string `json:"wallet_name"`
		}
		var txs []tx
		for rows.Next() {
			var t1 tx
			var date time.Time
			var note, catName, wName sql.NullString
			rows.Scan(&t1.Amount, &t1.Type, &date, &note, &catName, &wName)
			t1.Date = date.Format("2006-01-02")
			t1.Note = note.String
			t1.CategoryName = catName.String
			t1.WalletName = wName.String
			txs = append(txs, t1)
		}
		b, _ := json.Marshal(txs)
		return string(b)

	case "get_recurring_rules":
		rows, err := db.DB.Query(`SELECT type, frequency, amount, start_date, next_due_date, note FROM recurring_rules WHERE user_id = $1 AND deleted_at IS NULL`, userID)
		if err != nil {
			return `{"error": "Failed to query database"}`
		}
		defer rows.Close()
		type rule struct {
			Type        string `json:"type"`
			Frequency   string `json:"frequency"`
			Amount      int64  `json:"amount"`
			StartDate   string `json:"start_date"`
			NextDueDate string `json:"next_due_date"`
			Note        string `json:"note"`
		}
		var rules []rule
		for rows.Next() {
			var r1 rule
			var sd time.Time
			var ndd *time.Time
			var n sql.NullString
			rows.Scan(&r1.Type, &r1.Frequency, &r1.Amount, &sd, &ndd, &n)
			r1.StartDate = sd.Format("2006-01-02")
			if ndd != nil {
				r1.NextDueDate = ndd.Format("2006-01-02")
			}
			r1.Note = n.String
			rules = append(rules, r1)
		}
		b, _ := json.Marshal(rules)
		return string(b)
	}

	return `{"error": "Unknown tool"}`
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

	openAIMessages := []openAIMessage{}

	// System Prompt
	systemContent := fmt.Sprintf(`Anda adalah Artha, Asisten Keuangan Pribadi dan Penasihat Finansial (Financial Advisor) yang cerdas, super analitis, dan ramah dari LaporUang.
Tugas Anda adalah membantu pengguna menganalisis keuangan, memberikan rekomendasi berhemat, mendeteksi anomali, merencanakan budget, dan memberikan insight bermanfaat.

Karakter Anda:
- Sangat profesional, berwibawa namun bersahabat.
- Selalu berbicara berdasarkan data numerik yang akurat (tidak berhalusinasi).
- Selalu memberikan insight taktis, actionable (bisa langsung dipraktikkan).
- Selalu gunakan format Rupiah (Rp) yang rapi.
- Tanggapi dalam Bahasa Indonesia yang baik dan natural.

Berikut adalah Ringkasan Finansial Pengguna terkini untuk referensi awal Anda:
%s

PENTING: Jika Anda butuh data lebih spesifik (seperti daftar transaksi riil, detail dompet, atau tagihan rutin pengguna), JANGAN BERHALUSINASI! Gunakan fungsi/tools yang tersedia untuk mengambil data langsung dari database sebelum Anda menjawab.`, summaryText)

	// We use pointer for content so we can send null if needed
	openAIMessages = append(openAIMessages, openAIMessage{
		Role:    "system",
		Content: &systemContent,
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
				
				// Make a copy of content since we take its pointer
				msgContent := content
				openAIMessages = append(openAIMessages, openAIMessage{Role: role, Content: &msgContent})
			}
		}
	}

	// Add current message if not already added
	if len(openAIMessages) == 1 { // only system prompt
		msgContent := req.Message
		openAIMessages = append(openAIMessages, openAIMessage{Role: "user", Content: &msgContent})
	}

	// 4. Construct request to OpenAI-compatible endpoint with Tool Calling Loop
	var aiContent string
	tools := getAIAvailableTools()

	maxIterations := 3
	for i := 0; i < maxIterations; i++ {
		reqBodyObj := map[string]interface{}{
			"model":       model,
			"messages":    openAIMessages,
			"temperature": 0.7,
			"tools":       tools,
			"tool_choice": "auto",
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

		client := &http.Client{Timeout: 60 * time.Second}
		aiResp, err := client.Do(aiReq)
		if err != nil {
			http.Error(w, "Failed to contact AI endpoint: "+err.Error(), http.StatusBadGateway)
			return
		}

		bodyBytes, err := io.ReadAll(aiResp.Body)
		aiResp.Body.Close()
		if err != nil {
			http.Error(w, "Failed to read response from AI service", http.StatusInternalServerError)
			return
		}

		if aiResp.StatusCode != http.StatusOK {
			http.Error(w, fmt.Sprintf("AI provider returned error code %d: %s", aiResp.StatusCode, string(bodyBytes)), http.StatusBadGateway)
			return
		}

		// Parse AI Response
		var aiRespBody struct {
			Choices []struct {
				Message struct {
					Role      string           `json:"role"`
					Content   *string          `json:"content"`
					ToolCalls []openAIToolCall `json:"tool_calls"`
				} `json:"message"`
			} `json:"choices"`
		}

		err = json.Unmarshal(bodyBytes, &aiRespBody)
		if err != nil || len(aiRespBody.Choices) == 0 {
			http.Error(w, "Failed to parse AI completion details: "+err.Error(), http.StatusInternalServerError)
			return
		}

		choiceMessage := aiRespBody.Choices[0].Message

		// If no tool calls, we are done
		if len(choiceMessage.ToolCalls) == 0 {
			if choiceMessage.Content != nil {
				aiContent = *choiceMessage.Content
			}
			break
		}

		// Append the assistant's message with tool_calls to history
		openAIMessages = append(openAIMessages, openAIMessage{
			Role:      "assistant",
			Content:   choiceMessage.Content,
			ToolCalls: choiceMessage.ToolCalls,
		})

		// Execute tools and append results
		for _, tc := range choiceMessage.ToolCalls {
			toolResult := executeAITool(userID, tc.Function.Name, tc.Function.Arguments)
			openAIMessages = append(openAIMessages, openAIMessage{
				Role:       "tool",
				Content:    &toolResult,
				ToolCallId: tc.Id,
			})
		}
	}

	if aiContent == "" {
		aiContent = "Maaf, saya mengalami kendala teknis saat memproses permintaan Anda (terlalu banyak panggilan tools atau respons kosong)."
	}

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
