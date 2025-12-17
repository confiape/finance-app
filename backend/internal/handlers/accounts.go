package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/warren/finance-app/internal/database"
)

type Account struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	Name          string    `json:"name"`
	Bank          *string   `json:"bank,omitempty"`
	AccountType   string    `json:"account_type"`
	Currency      string    `json:"currency"`
	AccountNumber *string   `json:"account_number,omitempty"`
	Color         string    `json:"color"`
	IsActive      bool      `json:"is_active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type CreateAccountRequest struct {
	Name          string  `json:"name" binding:"required"`
	Bank          *string `json:"bank"`
	AccountType   string  `json:"account_type"`
	Currency      string  `json:"currency"`
	AccountNumber *string `json:"account_number"`
	Color         string  `json:"color"`
}

type UpdateAccountRequest struct {
	Name          string  `json:"name" binding:"required"`
	Bank          *string `json:"bank"`
	AccountType   string  `json:"account_type"`
	Currency      string  `json:"currency"`
	AccountNumber *string `json:"account_number"`
	Color         string  `json:"color"`
	IsActive      bool    `json:"is_active"`
}

// GetAccounts returns all accounts for the authenticated user
func GetAccounts(c *gin.Context) {
	userID := c.GetInt("user_id")

	rows, err := database.DB.Query(`
		SELECT id, user_id, name, bank, account_type, currency, account_number, color, is_active, created_at, updated_at
		FROM accounts
		WHERE user_id = $1 AND is_active = TRUE
		ORDER BY name
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching accounts"})
		return
	}
	defer rows.Close()

	accounts := []Account{}
	for rows.Next() {
		var acc Account
		err := rows.Scan(&acc.ID, &acc.UserID, &acc.Name, &acc.Bank, &acc.AccountType, &acc.Currency,
			&acc.AccountNumber, &acc.Color, &acc.IsActive, &acc.CreatedAt, &acc.UpdatedAt)
		if err != nil {
			continue
		}
		accounts = append(accounts, acc)
	}

	c.JSON(http.StatusOK, accounts)
}

// GetAccount returns a single account
func GetAccount(c *gin.Context) {
	userID := c.GetInt("user_id")
	accountID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	var acc Account
	err = database.DB.QueryRow(`
		SELECT id, user_id, name, bank, account_type, currency, account_number, color, is_active, created_at, updated_at
		FROM accounts
		WHERE id = $1 AND user_id = $2
	`, accountID, userID).Scan(&acc.ID, &acc.UserID, &acc.Name, &acc.Bank, &acc.AccountType, &acc.Currency,
		&acc.AccountNumber, &acc.Color, &acc.IsActive, &acc.CreatedAt, &acc.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Account not found"})
		return
	}

	c.JSON(http.StatusOK, acc)
}

// CreateAccount creates a new account
func CreateAccount(c *gin.Context) {
	userID := c.GetInt("user_id")

	var req CreateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Set defaults
	if req.Currency == "" {
		req.Currency = "PEN"
	}
	if req.Color == "" {
		req.Color = "#6366f1"
	}
	if req.AccountType == "" {
		req.AccountType = "debit"
	}

	var acc Account
	err := database.DB.QueryRow(`
		INSERT INTO accounts (user_id, name, bank, account_type, currency, account_number, color)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, user_id, name, bank, account_type, currency, account_number, color, is_active, created_at, updated_at
	`, userID, req.Name, req.Bank, req.AccountType, req.Currency, req.AccountNumber, req.Color).Scan(
		&acc.ID, &acc.UserID, &acc.Name, &acc.Bank, &acc.AccountType, &acc.Currency,
		&acc.AccountNumber, &acc.Color, &acc.IsActive, &acc.CreatedAt, &acc.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating account"})
		return
	}

	c.JSON(http.StatusCreated, acc)
}

// UpdateAccount updates an existing account
func UpdateAccount(c *gin.Context) {
	userID := c.GetInt("user_id")
	accountID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	var req UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.Currency == "" {
		req.Currency = "PEN"
	}
	if req.Color == "" {
		req.Color = "#6366f1"
	}

	var acc Account
	err = database.DB.QueryRow(`
		UPDATE accounts
		SET name = $1, bank = $2, account_type = $3, currency = $4, account_number = $5, color = $6, is_active = $7, updated_at = NOW()
		WHERE id = $8 AND user_id = $9
		RETURNING id, user_id, name, bank, account_type, currency, account_number, color, is_active, created_at, updated_at
	`, req.Name, req.Bank, req.AccountType, req.Currency, req.AccountNumber, req.Color, req.IsActive, accountID, userID).Scan(
		&acc.ID, &acc.UserID, &acc.Name, &acc.Bank, &acc.AccountType, &acc.Currency,
		&acc.AccountNumber, &acc.Color, &acc.IsActive, &acc.CreatedAt, &acc.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Account not found"})
		return
	}

	c.JSON(http.StatusOK, acc)
}

// DeleteAccount soft-deletes an account
func DeleteAccount(c *gin.Context) {
	userID := c.GetInt("user_id")
	accountID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	result, err := database.DB.Exec(`
		UPDATE accounts SET is_active = FALSE, updated_at = NOW()
		WHERE id = $1 AND user_id = $2
	`, accountID, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting account"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Account not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Account deleted"})
}

// GetAccountBalance returns the balance for an account
func GetAccountBalance(c *gin.Context) {
	userID := c.GetInt("user_id")
	accountID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	var income, expense float64
	err = database.DB.QueryRow(`
		SELECT
			COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
			COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		FROM transactions
		WHERE user_id = $1 AND account_id = $2
	`, userID, accountID).Scan(&income, &expense)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error calculating balance"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"income":  income,
		"expense": expense,
		"balance": income - expense,
	})
}
