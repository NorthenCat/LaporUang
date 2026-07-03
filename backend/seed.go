//go:build ignore

package main

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

func main() {
	connStr := "host=localhost port=5432 user=dev password=dev123 dbname=laporuang sslmode=disable"
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Error connecting to db: %v", err)
	}
	defer db.Close()

	userID := "cdb2d052-dd40-48b6-96d8-1d9bfae294e7" // faldzddi

	// Delete existing data for this user to avoid duplicates if rerun
	fmt.Println("Cleaning up existing data for user...")
	db.Exec("DELETE FROM cashflow_adjustments WHERE user_id = $1", userID)
	db.Exec("DELETE FROM recurring_rules WHERE user_id = $1", userID)
	db.Exec("DELETE FROM budgets WHERE user_id = $1", userID)
	db.Exec("DELETE FROM transactions WHERE user_id = $1", userID)
	db.Exec("DELETE FROM wallets WHERE user_id = $1", userID)
	db.Exec("DELETE FROM categories WHERE user_id = $1", userID)

	// Create Wallets
	fmt.Println("Creating wallets...")
	wallets := []struct {
		id      string
		name    string
		wtype   string
		color   string
		icon    string
		balance int64
	}{
		{uuid.New().String(), "BCA Utama", "bank", "#0066AE", "CreditCard", 12500000},
		{uuid.New().String(), "Gopay", "e-wallet", "#00AED6", "Wallet", 1500000},
		{uuid.New().String(), "Uang Tunai", "cash", "#10B981", "Banknote", 450000},
	}

	for _, w := range wallets {
		_, err := db.Exec(`
			INSERT INTO wallets (id, user_id, name, balance, type, color, icon)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, w.id, userID, w.name, w.balance, w.wtype, w.color, w.icon)
		if err != nil {
			log.Fatalf("Error inserting wallet: %v", err)
		}
	}

	// Create Categories
	fmt.Println("Creating categories...")
	categories := []struct {
		id    string
		name  string
		ctype string
		color string
		icon  string
	}{
		{uuid.New().String(), "Gaji", "income", "#10B981", "Briefcase"},         // 0
		{uuid.New().String(), "Bonus", "income", "#3B82F6", "Gift"},              // 1
		{uuid.New().String(), "Makanan", "expense", "#EF4444", "Utensils"},       // 2
		{uuid.New().String(), "Transportasi", "expense", "#F59E0B", "Car"},       // 3
		{uuid.New().String(), "Belanja", "expense", "#8B5CF6", "ShoppingBag"},    // 4
		{uuid.New().String(), "Tagihan", "expense", "#EC4899", "FileText"},       // 5
		{uuid.New().String(), "Hiburan", "expense", "#F43F5E", "Tv"},             // 6
		{uuid.New().String(), "Kesehatan", "expense", "#14B8A6", "HeartPulse"},   // 7
	}

	for _, c := range categories {
		_, err := db.Exec(`
			INSERT INTO categories (id, user_id, name, type, color, icon)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, c.id, userID, c.name, c.ctype, c.color, c.icon)
		if err != nil {
			log.Fatalf("Error inserting category: %v", err)
		}
	}

	fmt.Println("Creating transactions (1 Year Data)...")
	now := time.Now()
	
	// Create income (Salary) once a month for the last 12 months
	for i := 0; i < 12; i++ {
		date := now.AddDate(0, -i, -rand.Intn(5))
		_, err := db.Exec(`
			INSERT INTO transactions (id, user_id, wallet_id, category_id, type, amount, date, note)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, uuid.New().String(), userID, wallets[0].id, categories[0].id, "income", 15000000, date, "Gaji Bulanan")
		if err != nil {
			log.Fatalf("Error inserting income: %v", err)
		}
	}

	// Create random expenses for the last 365 days
	for i := 0; i < 150; i++ {
		date := now.AddDate(0, 0, -rand.Intn(365))
		w := wallets[rand.Intn(len(wallets))]
		// Pick an expense category (index 2 to 7)
		c := categories[rand.Intn(6)+2]
		
		amount := int64((rand.Intn(100) + 10) * 1000) // 10k to 110k
		if c.name == "Belanja" || c.name == "Tagihan" || c.name == "Kesehatan" {
			amount = int64((rand.Intn(500) + 100) * 1000) // 100k to 600k
		}
		
		note := "Dummy " + c.name

		_, err := db.Exec(`
			INSERT INTO transactions (idt, user_id, wallet_id, category_id, type, amount, date, note)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, uuid.New().String(), userID, w.id, c.id, "expense", amount, date, note)
		if err != nil {
			log.Fatalf("Error inserting expense: %v", err)
		}
	}

	fmt.Println("Creating Budgets (1 Year Data)...")
	// For each expense category, create a monthly budget for the last 12 months and current month
	expenseCategories := categories[2:]
	for i := 0; i < 12; i++ {
		for _, c := range expenseCategories {
			periodStart := time.Date(now.Year(), now.Month()-time.Month(i), 1, 0, 0, 0, 0, now.Location())
			periodEnd := periodStart.AddDate(0, 1, -1) // last day of the month

			budgetAmount := int64(1000000) // Default 1M
			if c.name == "Makanan" {
				budgetAmount = 3000000
			} else if c.name == "Transportasi" {
				budgetAmount = 1500000
			}

			_, err := db.Exec(`
				INSERT INTO budgets (id, user_id, category_id, amount, period_start, period_end)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, uuid.New().String(), userID, c.id, budgetAmount, periodStart, periodEnd)
			if err != nil {
				log.Fatalf("Error inserting budget: %v", err)
			}
		}
	}

	fmt.Println("Creating Recurring Rules (Fixed Expenses)...")
	recurringRules := []struct {
		id         string
		walletID   string
		categoryID string
		amount     int64
		note       string
		rtype      string
		frequency  string
		startDate  time.Time
		nextDue    time.Time
	}{
		{
			id:         uuid.New().String(),
			walletID:   wallets[0].id,
			categoryID: categories[5].id, // Tagihan
			amount:     550000,
			note:       "Internet Bulanan",
			rtype:      "expense",
			frequency:  "monthly",
			startDate:  now.AddDate(-1, 0, 0),
			nextDue:    now.AddDate(0, 0, 5),
		},
		{
			id:         uuid.New().String(),
			walletID:   wallets[0].id,
			categoryID: categories[5].id, // Tagihan
			amount:     250000,
			note:       "Listrik",
			rtype:      "expense",
			frequency:  "monthly",
			startDate:  now.AddDate(-1, 0, 0),
			nextDue:    now.AddDate(0, 0, 12),
		},
		{
			id:         uuid.New().String(),
			walletID:   wallets[1].id,
			categoryID: categories[6].id, // Hiburan
			amount:     150000,
			note:       "Langganan Netflix",
			rtype:      "expense",
			frequency:  "monthly",
			startDate:  now.AddDate(-1, 0, 0),
			nextDue:    now.AddDate(0, 0, 2),
		},
		{
			id:         uuid.New().String(),
			walletID:   wallets[0].id,
			categoryID: categories[0].id, // Gaji
			amount:     15000000,
			note:       "Gaji Bulanan",
			rtype:      "income",
			frequency:  "monthly",
			startDate:  now.AddDate(-1, 0, 0),
			nextDue:    now.AddDate(0, 0, 25), // Payday
		},
	}

	for _, rr := range recurringRules {
		_, err := db.Exec(`
			INSERT INTO recurring_rules (id, user_id, wallet_id, category_id, amount, note, type, frequency, start_date, next_due_date)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, rr.id, userID, rr.walletID, rr.categoryID, rr.amount, rr.note, rr.rtype, rr.frequency, rr.startDate, rr.nextDue)
		if err != nil {
			log.Fatalf("Error inserting recurring rule: %v", err)
		}
	}

	fmt.Println("Creating Cashflow Adjustments (Projections)...")
	adjustments := []struct {
		id     string
		date   time.Time
		amount int64
		atype  string
		note   string
	}{
		{uuid.New().String(), now.AddDate(0, 0, 15), 5000000, "income", "Bonus Proyek"},
		{uuid.New().String(), now.AddDate(0, 1, 0), 2000000, "expense", "Servis Kendaraan"},
		{uuid.New().String(), now.AddDate(0, 2, 0), 3000000, "expense", "Liburan Pendek"},
	}

	for _, a := range adjustments {
		_, err := db.Exec(`
			INSERT INTO cashflow_adjustments (id, user_id, date, amount, type, note)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, a.id, userID, a.date, a.amount, a.atype, a.note)
		if err != nil {
			log.Fatalf("Error inserting cashflow adjustment: %v", err)
		}
	}

	fmt.Println("Dummy data (Full 1 Year) successfully generated!")
}
