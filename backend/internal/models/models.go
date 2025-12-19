package models

import (
	"time"
)

type User struct {
	ID           int       `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Tag struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"created_at"`
}

type Transaction struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	AccountID   *int      `json:"account_id,omitempty"`
	Description string    `json:"description"`
	Detail      *string   `json:"detail,omitempty"` // User-defined detail/note
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"` // PEN, USD
	Type        string    `json:"type"`     // income, expense
	Date        string    `json:"date"`
	Source      string    `json:"source"` // manual, excel, image
	RawText     *string   `json:"raw_text,omitempty"`
	LinkedTo    *int      `json:"linked_to,omitempty"` // ID of linked transaction (for reimbursements)
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Tags        []Tag     `json:"tags"`
	Account     *Account  `json:"account,omitempty"`
	LinkedTx    *Transaction `json:"linked_transaction,omitempty"` // The linked transaction details
}

type Account struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	AccountType string `json:"account_type"`
}

type Import struct {
	ID                    int       `json:"id"`
	UserID                int       `json:"user_id"`
	Filename              string    `json:"filename"`
	FileType              string    `json:"file_type"` // excel, image
	Status                string    `json:"status"`    // pending, processing, completed, failed
	TotalTransactions     int       `json:"total_transactions"`
	ProcessedTransactions int       `json:"processed_transactions"`
	CreatedAt             time.Time `json:"created_at"`
}

// DTOs
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Name     string `json:"name" binding:"required,min=2"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CreateTransactionRequest struct {
	TagIDs      []int   `json:"tag_ids"`
	Description string  `json:"description" binding:"required"`
	Detail      *string `json:"detail"`
	Amount      float64 `json:"amount" binding:"required"`
	Currency    string  `json:"currency"` // PEN, USD - defaults to PEN
	Type        string  `json:"type" binding:"required,oneof=income expense"`
	Date        string  `json:"date" binding:"required"`
}

type DashboardSummary struct {
	TotalIncome      float64       `json:"total_income"`
	TotalExpense     float64       `json:"total_expense"`
	Balance          float64       `json:"balance"`
	TransactionCount int           `json:"transaction_count"`
	ByTag            []TagSummary  `json:"by_tag"`
	RecentTx         []Transaction `json:"recent_transactions"`
}

type TagSummary struct {
	TagID    int     `json:"tag_id"`
	TagName  string  `json:"tag_name"`
	Color    string  `json:"color"`
	Total    float64 `json:"total"`
	TotalPEN float64 `json:"total_pen"`
	TotalUSD float64 `json:"total_usd"`
	Count    int     `json:"count"`
	Type     string  `json:"type"`
}

type PendingTransaction struct {
	ID          int     `json:"id"`
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
	Type        string  `json:"type"`
	Date        string  `json:"date"`
	RawText     string  `json:"raw_text"`
	ImportID    int     `json:"import_id"`
}
