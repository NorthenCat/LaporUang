package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"backend/db"
	"backend/handlers"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables from .env
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: No .env file found, using system variables")
	}

	// Initialize Database
	db.InitDB()

	// Ensure upload directory exists
	uploadsDir := os.Getenv("UPLOADS_DIR")
	if uploadsDir == "" {
		uploadsDir = "./uploads"
	}
	err = os.MkdirAll(uploadsDir, 0755)
	if err != nil {
		log.Fatalf("Error creating uploads folder: %v", err)
	}

	// Create Chi Router
	r := chi.NewRouter()

	// Standard middlewares
	r.Use(RequestLogger)
	r.Use(middleware.Recoverer)
	r.Use(CORSMiddleware)

	// Auth Endpoints
	r.Post("/api/auth/register", handlers.RegisterHandler)
	r.Post("/api/auth/login", handlers.LoginHandler)

	// Authenticated Routes
	r.Group(func(r chi.Router) {
		// Use manual JWT wrapper as middleware
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				handlers.JWTAuthMiddleware(func(w http.ResponseWriter, req *http.Request) {
					next.ServeHTTP(w, req)
				})(w, req)
			})
		})

		// Wallets CRUD
		r.Get("/api/wallets", handlers.GetWalletsHandler)
		r.Post("/api/wallets", handlers.CreateWalletHandler)
		r.Put("/api/wallets/{id}", handlers.UpdateWalletHandler)
		r.Delete("/api/wallets/{id}", handlers.DeleteWalletHandler)

		// Categories CRUD
		r.Get("/api/categories", handlers.GetCategoriesHandler)
		r.Post("/api/categories", handlers.CreateCategoryHandler)
		r.Put("/api/categories/{id}", handlers.UpdateCategoryHandler)
		r.Delete("/api/categories/{id}", handlers.DeleteCategoryHandler)

		// Transactions
		r.Get("/api/transactions", handlers.GetTransactionsHandler)
		r.Post("/api/transactions", handlers.CreateTransactionHandler)
		r.Delete("/api/transactions/{id}", handlers.DeleteTransactionHandler)
		r.Get("/api/transactions/{id}/attachment", handlers.GetTransactionAttachmentHandler)

		// Budgets
		r.Get("/api/budgets", handlers.GetBudgetsHandler)
		r.Post("/api/budgets", handlers.CreateBudgetHandler)
		r.Put("/api/budgets/{id}", handlers.UpdateBudgetHandler)
		r.Delete("/api/budgets/{id}", handlers.DeleteBudgetHandler)

		// Recurring Rules (Fixed Expenses)
		r.Get("/api/recurring-rules", handlers.GetRecurringRulesHandler)
		r.Post("/api/recurring-rules", handlers.CreateRecurringRuleHandler)
		r.Delete("/api/recurring-rules/{id}", handlers.DeleteRecurringRuleHandler)
		r.Post("/api/recurring-rules/{id}/execute", handlers.ExecuteRecurringRuleHandler)

		// Projections
		r.Get("/api/projections", handlers.GetProjectionsHandler)
		r.Get("/api/projections/adjustments", handlers.GetAdjustmentsHandler)
		r.Post("/api/projections/adjustments", handlers.CreateAdjustmentHandler)
		r.Delete("/api/projections/adjustments/{id}", handlers.DeleteAdjustmentHandler)

		// Settings
		r.Get("/api/settings", handlers.GetSettingsHandler)
		r.Post("/api/settings", handlers.SaveSettingsHandler)
		r.Post("/api/settings/verify-pin", handlers.VerifyPINHandler)

		// AI Endpoints
		r.Get("/api/ai/provider", handlers.GetAIProviderHandler)
		r.Post("/api/ai/provider", handlers.ConfigureAIProviderHandler)
		r.Get("/api/ai/models", handlers.GetAIModelsHandler)
		r.Get("/api/ai/sessions", handlers.GetAIChatSessionsHandler)
		r.Post("/api/ai/sessions", handlers.CreateAIChatSessionHandler)
		r.Put("/api/ai/sessions/{sessionId}", handlers.UpdateAIChatSessionHandler)
		r.Get("/api/ai/sessions/{sessionId}/messages", handlers.GetAIMessagesHandler)
		r.Post("/api/ai/sessions/{sessionId}/chat", handlers.SendAIMessageHandler)

		// File Upload
		r.Post("/api/upload", handlers.UploadReceiptHandler)
	})

	// Serve Static Upload Files
	fileServer := http.FileServer(http.Dir(uploadsDir))
	r.Handle("/uploads/*", http.StripPrefix("/uploads", fileServer))

	// Simple Health Check Endpoint
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"LaporUang Go REST Backend"}`))
	})

	// Start Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8282"
	}
	log.Printf("LaporUang Backend started on localhost:%s (Local Only)", port)
	log.Fatal(http.ListenAndServe("127.0.0.1:"+port, r))
}

// CORSMiddleware handles Cross-Origin Resource Sharing for local development
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// RequestLogger is a custom developer logging middleware for REST requests
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		
		// Wrap ResponseWriter to capture the status code
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		
		next.ServeHTTP(ww, r)
		
		duration := time.Since(start)
		log.Printf("[DEV API] %s | %s | Status: %d | Time: %v",
			r.Method, r.URL.Path, ww.Status(), duration)
	})
}
