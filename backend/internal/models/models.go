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

type Category struct {
	ID            int         `json:"id"`
	UserID        *int        `json:"user_id,omitempty"`
	ParentID      *int        `json:"parent_id,omitempty"`
	Name          string      `json:"name"`
	Type          string      `json:"type"` // income, expense
	Color         string      `json:"color"`
	Icon          string      `json:"icon"`
	IsDefault     bool        `json:"is_default"`
	CreatedAt     time.Time   `json:"created_at"`
	Subcategories []Category  `json:"subcategories,omitempty"`
	Parent        *Category   `json:"parent,omitempty"`
}

type Transaction struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	CategoryID  *int      `json:"category_id,omitempty"`
	Description string    `json:"description"`
	Detail      *string   `json:"detail,omitempty"` // User-defined detail/note
	Amount      float64   `json:"amount"`
	Type        string    `json:"type"` // income, expense
	Date        string    `json:"date"`
	Source      string    `json:"source"` // manual, excel, image
	RawText     *string   `json:"raw_text,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Category    *Category `json:"category,omitempty"`
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
	CategoryID  *int    `json:"category_id"`
	Description string  `json:"description" binding:"required"`
	Detail      *string `json:"detail"`
	Amount      float64 `json:"amount" binding:"required"`
	Type        string  `json:"type" binding:"required,oneof=income expense"`
	Date        string  `json:"date" binding:"required"`
}

type UpdateCategoryRequest struct {
	CategoryID int `json:"category_id" binding:"required"`
}

type DashboardSummary struct {
	TotalIncome      float64           `json:"total_income"`
	TotalExpense     float64           `json:"total_expense"`
	Balance          float64           `json:"balance"`
	TransactionCount int               `json:"transaction_count"`
	ByCategory       []CategorySummary `json:"by_category"`
	RecentTx         []Transaction     `json:"recent_transactions"`
}

type CategorySummary struct {
	CategoryID   int     `json:"category_id"`
	CategoryName string  `json:"category_name"`
	Color        string  `json:"color"`
	Total        float64 `json:"total"`
	Count        int     `json:"count"`
	Type         string  `json:"type"`
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
