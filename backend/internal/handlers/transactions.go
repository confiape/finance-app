package handlers

import (
	"net/http"
	"strconv"
	"strings"

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
	tagID := c.Query("tag_id")
	tagIDs := c.Query("tag_ids") // comma-separated list of tag IDs
	accountID := c.Query("account_id")
	accountType := c.Query("account_type")

	query := `
		SELECT t.id, t.user_id, t.description, t.detail, t.amount, t.currency, t.type,
		       t.date, t.source, t.raw_text, t.created_at, t.updated_at,
		       t.account_id, a.name, a.account_type
		FROM transactions t
		LEFT JOIN accounts a ON t.account_id = a.id
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
	if tagID != "" {
		argCount++
		query += " AND EXISTS (SELECT 1 FROM transaction_tags tt WHERE tt.transaction_id = t.id AND tt.tag_id = $" + strconv.Itoa(argCount) + ")"
		args = append(args, tagID)
	}
	if tagIDs != "" {
		// Parse comma-separated tag IDs
		tagIDStrings := strings.Split(tagIDs, ",")
		var tagIDInts []int
		for _, idStr := range tagIDStrings {
			if id, err := strconv.Atoi(strings.TrimSpace(idStr)); err == nil {
				tagIDInts = append(tagIDInts, id)
			}
		}
		if len(tagIDInts) > 0 {
			argCount++
			query += " AND EXISTS (SELECT 1 FROM transaction_tags tt WHERE tt.transaction_id = t.id AND tt.tag_id = ANY($" + strconv.Itoa(argCount) + "))"
			args = append(args, pq.Array(tagIDInts))
		}
	}
	if accountID != "" {
		argCount++
		query += " AND t.account_id = $" + strconv.Itoa(argCount)
		args = append(args, accountID)
	}
	if accountType != "" {
		argCount++
		query += " AND a.account_type = $" + strconv.Itoa(argCount)
		args = append(args, accountType)
	}

	query += " ORDER BY t.date DESC, t.created_at DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching transactions"})
		return
	}
	defer rows.Close()

	var transactions []models.Transaction
	transactionIDs := []int{}

	for rows.Next() {
		var t models.Transaction
		var accountID *int
		var accountName, accountAccType *string

		err := rows.Scan(
			&t.ID, &t.UserID, &t.Description, &t.Detail, &t.Amount, &t.Currency, &t.Type,
			&t.Date, &t.Source, &t.RawText, &t.CreatedAt, &t.UpdatedAt,
			&accountID, &accountName, &accountAccType,
		)
		if err != nil {
			continue
		}

		if accountID != nil {
			t.AccountID = accountID
			t.Account = &models.Account{
				ID:          *accountID,
				Name:        *accountName,
				AccountType: *accountAccType,
			}
		}

		t.Tags = []models.Tag{}
		transactions = append(transactions, t)
		transactionIDs = append(transactionIDs, t.ID)
	}

	// Fetch tags for all transactions
	if len(transactionIDs) > 0 {
		tagRows, err := database.DB.Query(`
			SELECT tt.transaction_id, tg.id, tg.user_id, tg.name, tg.color, tg.created_at
			FROM transaction_tags tt
			JOIN tags tg ON tt.tag_id = tg.id
			WHERE tt.transaction_id = ANY($1)
		`, pq.Array(transactionIDs))
		if err == nil {
			defer tagRows.Close()
			tagMap := make(map[int][]models.Tag)
			for tagRows.Next() {
				var txID int
				var tag models.Tag
				if err := tagRows.Scan(&txID, &tag.ID, &tag.UserID, &tag.Name, &tag.Color, &tag.CreatedAt); err == nil {
					tagMap[txID] = append(tagMap[txID], tag)
				}
			}
			for i := range transactions {
				if tags, ok := tagMap[transactions[i].ID]; ok {
					transactions[i].Tags = tags
				}
			}
		}
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

	// Default currency to PEN if not specified
	currency := req.Currency
	if currency == "" {
		currency = "PEN"
	}

	// Start transaction
	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error starting transaction"})
		return
	}
	defer tx.Rollback()

	var t models.Transaction
	err = tx.QueryRow(
		`INSERT INTO transactions (user_id, description, detail, amount, currency, type, date, source)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')
		 RETURNING id, user_id, description, detail, amount, currency, type, date, source, created_at, updated_at`,
		userID, req.Description, req.Detail, req.Amount, currency, req.Type, req.Date,
	).Scan(&t.ID, &t.UserID, &t.Description, &t.Detail, &t.Amount, &t.Currency, &t.Type, &t.Date, &t.Source, &t.CreatedAt, &t.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating transaction"})
		return
	}

	// Insert tags
	t.Tags = []models.Tag{}
	for _, tagID := range req.TagIDs {
		_, err = tx.Exec(`
			INSERT INTO transaction_tags (transaction_id, tag_id)
			SELECT $1, $2
			WHERE EXISTS (SELECT 1 FROM tags WHERE id = $2 AND user_id = $3)
		`, t.ID, tagID, userID)
		if err != nil {
			continue
		}
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error committing transaction"})
		return
	}

	// Fetch tags for response
	if len(req.TagIDs) > 0 {
		tagRows, err := database.DB.Query(`
			SELECT tg.id, tg.user_id, tg.name, tg.color, tg.created_at
			FROM transaction_tags tt
			JOIN tags tg ON tt.tag_id = tg.id
			WHERE tt.transaction_id = $1
		`, t.ID)
		if err == nil {
			defer tagRows.Close()
			for tagRows.Next() {
				var tag models.Tag
				if err := tagRows.Scan(&tag.ID, &tag.UserID, &tag.Name, &tag.Color, &tag.CreatedAt); err == nil {
					t.Tags = append(t.Tags, tag)
				}
			}
		}
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

	// Default currency to PEN if not specified
	currency := req.Currency
	if currency == "" {
		currency = "PEN"
	}

	// Start transaction
	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error starting transaction"})
		return
	}
	defer tx.Rollback()

	var t models.Transaction
	err = tx.QueryRow(
		`UPDATE transactions
		 SET description = $1, detail = $2, amount = $3, currency = $4, type = $5, date = $6, updated_at = NOW()
		 WHERE id = $7 AND user_id = $8
		 RETURNING id, user_id, description, detail, amount, currency, type, date, source, created_at, updated_at`,
		req.Description, req.Detail, req.Amount, currency, req.Type, req.Date, txID, userID,
	).Scan(&t.ID, &t.UserID, &t.Description, &t.Detail, &t.Amount, &t.Currency, &t.Type, &t.Date, &t.Source, &t.CreatedAt, &t.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
		return
	}

	// Update tags - delete existing and insert new
	_, _ = tx.Exec(`DELETE FROM transaction_tags WHERE transaction_id = $1`, t.ID)

	t.Tags = []models.Tag{}
	for _, tagID := range req.TagIDs {
		_, err = tx.Exec(`
			INSERT INTO transaction_tags (transaction_id, tag_id)
			SELECT $1, $2
			WHERE EXISTS (SELECT 1 FROM tags WHERE id = $2 AND user_id = $3)
		`, t.ID, tagID, userID)
		if err != nil {
			continue
		}
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error committing transaction"})
		return
	}

	// Fetch tags for response
	tagRows, err := database.DB.Query(`
		SELECT tg.id, tg.user_id, tg.name, tg.color, tg.created_at
		FROM transaction_tags tt
		JOIN tags tg ON tt.tag_id = tg.id
		WHERE tt.transaction_id = $1
	`, t.ID)
	if err == nil {
		defer tagRows.Close()
		for tagRows.Next() {
			var tag models.Tag
			if err := tagRows.Scan(&tag.ID, &tag.UserID, &tag.Name, &tag.Color, &tag.CreatedAt); err == nil {
				t.Tags = append(t.Tags, tag)
			}
		}
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

// LinkTransactions links two transactions together (expense + reimbursement)
func LinkTransactions(c *gin.Context) {
	userID := c.GetInt("user_id")

	var req struct {
		TransactionID1 int `json:"transaction_id_1" binding:"required"`
		TransactionID2 int `json:"transaction_id_2" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Both transaction IDs are required"})
		return
	}

	if req.TransactionID1 == req.TransactionID2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot link a transaction to itself"})
		return
	}

	// Verify both transactions belong to user and get their types
	var tx1Type, tx2Type string
	var tx1Linked, tx2Linked *int

	err := database.DB.QueryRow(`
		SELECT type, linked_to FROM transactions WHERE id = $1 AND user_id = $2
	`, req.TransactionID1, userID).Scan(&tx1Type, &tx1Linked)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction 1 not found"})
		return
	}

	err = database.DB.QueryRow(`
		SELECT type, linked_to FROM transactions WHERE id = $1 AND user_id = $2
	`, req.TransactionID2, userID).Scan(&tx2Type, &tx2Linked)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction 2 not found"})
		return
	}

	// Check if either is already linked
	if tx1Linked != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Transaction 1 is already linked to another transaction"})
		return
	}
	if tx2Linked != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Transaction 2 is already linked to another transaction"})
		return
	}

	// Check that they are different types (expense + income)
	if tx1Type == tx2Type {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot link two transactions of the same type. One must be expense, one must be income."})
		return
	}

	// Link them bidirectionally
	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error starting transaction"})
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(`UPDATE transactions SET linked_to = $1 WHERE id = $2`, req.TransactionID2, req.TransactionID1)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error linking transactions"})
		return
	}

	_, err = tx.Exec(`UPDATE transactions SET linked_to = $1 WHERE id = $2`, req.TransactionID1, req.TransactionID2)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error linking transactions"})
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error committing transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Transactions linked successfully"})
}

// UnlinkTransaction removes the link between two transactions
func UnlinkTransaction(c *gin.Context) {
	userID := c.GetInt("user_id")
	txID := c.Param("id")

	// Get the linked transaction ID
	var linkedTo *int
	err := database.DB.QueryRow(`
		SELECT linked_to FROM transactions WHERE id = $1 AND user_id = $2
	`, txID, userID).Scan(&linkedTo)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
		return
	}

	if linkedTo == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Transaction is not linked"})
		return
	}

	// Unlink both sides
	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error starting transaction"})
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(`UPDATE transactions SET linked_to = NULL WHERE id = $1`, txID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error unlinking transaction"})
		return
	}

	_, err = tx.Exec(`UPDATE transactions SET linked_to = NULL WHERE id = $1`, *linkedTo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error unlinking transaction"})
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error committing transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Transaction unlinked successfully"})
}
