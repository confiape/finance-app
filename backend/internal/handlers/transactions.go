package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"github.com/warren/finance-app/internal/database"
	"github.com/warren/finance-app/internal/models"
)

func GetTransactions(c *gin.Context) {
	userID := c.GetInt("user_id")

	// Query parameters for filtering
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	txType := c.Query("type")
	categoryID := c.Query("category_id")

	query := `
		SELECT t.id, t.user_id, t.category_id, t.description, t.detail, t.amount, t.type,
		       t.date, t.source, t.raw_text, t.created_at, t.updated_at,
		       c.id, c.name, c.type, c.color, c.icon
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.user_id = $1
	`
	args := []interface{}{userID}
	argCount := 1

	if startDate != "" {
		argCount++
		query += " AND t.date >= $" + strconv.Itoa(argCount)
		args = append(args, startDate)
	}
	if endDate != "" {
		argCount++
		query += " AND t.date <= $" + strconv.Itoa(argCount)
		args = append(args, endDate)
	}
	if txType != "" {
		argCount++
		query += " AND t.type = $" + strconv.Itoa(argCount)
		args = append(args, txType)
	}
	if categoryID != "" {
		argCount++
		query += " AND t.category_id = $" + strconv.Itoa(argCount)
		args = append(args, categoryID)
	}

	query += " ORDER BY t.date DESC, t.created_at DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching transactions"})
		return
	}
	defer rows.Close()

	var transactions []models.Transaction
	for rows.Next() {
		var t models.Transaction
		var catID, catName, catType, catColor, catIcon *string

		err := rows.Scan(
			&t.ID, &t.UserID, &t.CategoryID, &t.Description, &t.Detail, &t.Amount, &t.Type,
			&t.Date, &t.Source, &t.RawText, &t.CreatedAt, &t.UpdatedAt,
			&catID, &catName, &catType, &catColor, &catIcon,
		)
		if err != nil {
			continue
		}

		if catID != nil {
			id, _ := strconv.Atoi(*catID)
			t.Category = &models.Category{
				ID:    id,
				Name:  *catName,
				Type:  *catType,
				Color: *catColor,
				Icon:  *catIcon,
			}
		}

		transactions = append(transactions, t)
	}

	if transactions == nil {
		transactions = []models.Transaction{}
	}

	c.JSON(http.StatusOK, transactions)
}

func CreateTransaction(c *gin.Context) {
	userID := c.GetInt("user_id")

	var req models.CreateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var t models.Transaction
	err := database.DB.QueryRow(
		`INSERT INTO transactions (user_id, category_id, description, detail, amount, type, date, source)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')
		 RETURNING id, user_id, category_id, description, detail, amount, type, date, source, created_at, updated_at`,
		userID, req.CategoryID, req.Description, req.Detail, req.Amount, req.Type, req.Date,
	).Scan(&t.ID, &t.UserID, &t.CategoryID, &t.Description, &t.Detail, &t.Amount, &t.Type, &t.Date, &t.Source, &t.CreatedAt, &t.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating transaction"})
		return
	}

	c.JSON(http.StatusCreated, t)
}

func UpdateTransaction(c *gin.Context) {
	userID := c.GetInt("user_id")
	txID := c.Param("id")

	var req models.CreateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var t models.Transaction
	err := database.DB.QueryRow(
		`UPDATE transactions
		 SET category_id = $1, description = $2, detail = $3, amount = $4, type = $5, date = $6, updated_at = NOW()
		 WHERE id = $7 AND user_id = $8
		 RETURNING id, user_id, category_id, description, detail, amount, type, date, source, created_at, updated_at`,
		req.CategoryID, req.Description, req.Detail, req.Amount, req.Type, req.Date, txID, userID,
	).Scan(&t.ID, &t.UserID, &t.CategoryID, &t.Description, &t.Detail, &t.Amount, &t.Type, &t.Date, &t.Source, &t.CreatedAt, &t.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
		return
	}

	c.JSON(http.StatusOK, t)
}

func DeleteTransaction(c *gin.Context) {
	userID := c.GetInt("user_id")
	txID := c.Param("id")

	result, err := database.DB.Exec(
		"DELETE FROM transactions WHERE id = $1 AND user_id = $2",
		txID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting transaction"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Transaction deleted"})
}

func UpdateTransactionCategory(c *gin.Context) {
	userID := c.GetInt("user_id")
	txID := c.Param("id")

	var req models.UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var t models.Transaction
	err := database.DB.QueryRow(
		`UPDATE transactions
		 SET category_id = $1, updated_at = NOW()
		 WHERE id = $2 AND user_id = $3
		 RETURNING id, user_id, category_id, description, detail, amount, type, date, source, created_at, updated_at`,
		req.CategoryID, txID, userID,
	).Scan(&t.ID, &t.UserID, &t.CategoryID, &t.Description, &t.Detail, &t.Amount, &t.Type, &t.Date, &t.Source, &t.CreatedAt, &t.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
		return
	}

	c.JSON(http.StatusOK, t)
}

// DeleteTransactionsBatch deletes multiple transactions
func DeleteTransactionsBatch(c *gin.Context) {
	userID := c.GetInt("user_id")

	var req struct {
		IDs []int `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request, 'ids' array required"})
		return
	}

	if len(req.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No transaction IDs provided"})
		return
	}

	// Build query with placeholders
	query := "DELETE FROM transactions WHERE user_id = $1 AND id = ANY($2)"
	result, err := database.DB.Exec(query, userID, pq.Array(req.IDs))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting transactions"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	c.JSON(http.StatusOK, gin.H{
		"message": "Transactions deleted",
		"deleted": rowsAffected,
	})
}
