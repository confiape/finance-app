package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/warren/finance-app/internal/database"
	"github.com/warren/finance-app/internal/services"
)

// TransactionWithSuggestion includes parsed transaction with category suggestion
type TransactionWithSuggestion struct {
	Description         string  `json:"description"`
	Amount              float64 `json:"amount"`
	Type                string  `json:"type"`
	Date                string  `json:"date"`
	RawText             string  `json:"raw_text"`
	SuggestedCategoryID *int    `json:"suggested_category_id,omitempty"`
	IsDuplicate         bool    `json:"is_duplicate"`
	ExistingCategoryID  *int    `json:"existing_category_id,omitempty"`
}

// GetBanks returns list of supported banks
func GetBanks(c *gin.Context) {
	banks := services.GetSupportedBanks()
	c.JSON(http.StatusOK, banks)
}

func UploadFile(c *gin.Context) {
	userID := c.GetInt("user_id")

	// Get bank ID from form
	bankID := c.PostForm("bank")
	if bankID == "" {
		bankID = "generic"
	}

	// Get account ID from form
	accountID := c.PostForm("account_id")
	if accountID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Account ID is required"})
		return
	}

	// Check if account is a credit card (for sign inversion)
	var accountType string
	var accountBank *string
	err := database.DB.QueryRow(`SELECT account_type, bank FROM accounts WHERE id = $1 AND user_id = $2`,
		accountID, userID).Scan(&accountType, &accountBank)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account"})
		return
	}

	// Determine if we need to invert signs (credit cards from BBVA)
	invertSigns := accountType == "credit" && accountBank != nil && *accountBank == "BBVA"

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Validate file type
	ext := strings.ToLower(filepath.Ext(file.Filename))
	validExts := map[string]bool{
		".xlsx": true,
		".xls":  true,
		".csv":  true,
		".png":  true,
		".jpg":  true,
		".jpeg": true,
	}

	if !validExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type. Supported: xlsx, xls, csv, png, jpg, jpeg"})
		return
	}

	// Create uploads directory
	uploadsDir := "./uploads"
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating uploads directory"})
		return
	}

	// Save file
	filename := filepath.Join(uploadsDir, file.Filename)
	if err := c.SaveUploadedFile(file, filename); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error saving file"})
		return
	}

	// Process based on file type
	var transactions []services.ParsedTransaction
	var importID int

	isImage := ext == ".png" || ext == ".jpg" || ext == ".jpeg"

	if isImage {
		transactions, importID, err = services.ProcessImageFile(filename, userID)
	} else {
		transactions, importID, err = services.ProcessExcelFile(filename, userID, bankID, invertSigns)
	}

	if err != nil {
		os.Remove(filename)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Clean up file
	os.Remove(filename)

	// Enhance transactions with suggestions and duplicate detection
	enhancedTransactions := enhanceTransactionsWithSuggestions(userID, transactions)

	// Include account_id in response for confirm step
	_ = accountID // Will be used in confirm

	c.JSON(http.StatusOK, gin.H{
		"import_id":    importID,
		"transactions": enhancedTransactions,
		"count":        len(enhancedTransactions),
		"bank":         bankID,
		"message":      "File processed. Please assign categories to transactions.",
	})
}

// enhanceTransactionsWithSuggestions checks for duplicates and suggests categories
func enhanceTransactionsWithSuggestions(userID int, transactions []services.ParsedTransaction) []TransactionWithSuggestion {
	result := make([]TransactionWithSuggestion, 0, len(transactions))

	for _, tx := range transactions {
		enhanced := TransactionWithSuggestion{
			Description: tx.Description,
			Amount:      tx.Amount,
			Type:        tx.Type,
			Date:        tx.Date,
			RawText:     tx.RawText,
			IsDuplicate: false,
		}

		// Check if exact transaction exists (same description, amount, date)
		// Use ROUND for amount to avoid float precision issues
		var existingID int
		var existingCatID *int
		err := database.DB.QueryRow(`
			SELECT id, category_id FROM transactions
			WHERE user_id = $1
			AND LOWER(TRIM(description)) = LOWER(TRIM($2))
			AND ROUND(amount::numeric, 2) = ROUND($3::numeric, 2)
			AND date = $4::date
			LIMIT 1
		`, userID, tx.Description, tx.Amount, tx.Date).Scan(&existingID, &existingCatID)

		if err == nil {
			// Transaction exists - it's a duplicate
			enhanced.IsDuplicate = true
			if existingCatID != nil {
				enhanced.ExistingCategoryID = existingCatID
				enhanced.SuggestedCategoryID = existingCatID
			}
		}

		// If not a duplicate or no category found, try to suggest one
		if enhanced.SuggestedCategoryID == nil {
			suggestedCatID := findCategorySuggestion(userID, tx.Description, tx.Type)
			if suggestedCatID != nil {
				enhanced.SuggestedCategoryID = suggestedCatID
			}
		}

		result = append(result, enhanced)
	}

	return result
}

// findCategorySuggestion finds a category based on similar past transactions
func findCategorySuggestion(userID int, description string, txType string) *int {
	// Normalize description for comparison
	descLower := strings.ToLower(description)

	// Extract key words from description (first word usually identifies the merchant)
	words := strings.Fields(descLower)
	if len(words) == 0 {
		return nil
	}

	// Try to find exact match first
	var categoryID *int
	err := database.DB.QueryRow(`
		SELECT category_id FROM transactions
		WHERE user_id = $1 AND LOWER(description) = $2 AND category_id IS NOT NULL
		ORDER BY created_at DESC
		LIMIT 1
	`, userID, descLower).Scan(&categoryID)

	if err == nil && categoryID != nil {
		return categoryID
	}

	// Try to find by first word (merchant name)
	firstWord := words[0]
	if len(firstWord) >= 3 {
		err = database.DB.QueryRow(`
			SELECT category_id FROM transactions
			WHERE user_id = $1 AND LOWER(description) LIKE $2 AND type = $3 AND category_id IS NOT NULL
			ORDER BY created_at DESC
			LIMIT 1
		`, userID, firstWord+"%", txType).Scan(&categoryID)

		if err == nil && categoryID != nil {
			return categoryID
		}
	}

	// Try partial match with any significant word
	for _, word := range words {
		if len(word) >= 4 { // Only consider words with 4+ characters
			err = database.DB.QueryRow(`
				SELECT category_id FROM transactions
				WHERE user_id = $1 AND LOWER(description) LIKE $2 AND type = $3 AND category_id IS NOT NULL
				ORDER BY created_at DESC
				LIMIT 1
			`, userID, "%"+word+"%", txType).Scan(&categoryID)

			if err == nil && categoryID != nil {
				return categoryID
			}
		}
	}

	return nil
}

func ConfirmImport(c *gin.Context) {
	userID := c.GetInt("user_id")

	var req struct {
		ImportID     int `json:"import_id" binding:"required"`
		AccountID    int `json:"account_id" binding:"required"`
		Transactions []struct {
			Description string  `json:"description"`
			Detail      *string `json:"detail"`
			Amount      float64 `json:"amount"`
			Type        string  `json:"type"`
			Date        string  `json:"date"`
			CategoryID  int     `json:"category_id"`
			RawText     string  `json:"raw_text"`
			IsDuplicate bool    `json:"is_duplicate"`
		} `json:"transactions" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify account belongs to user
	var accountExists bool
	database.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM accounts WHERE id = $1 AND user_id = $2)`,
		req.AccountID, userID).Scan(&accountExists)
	if !accountExists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account"})
		return
	}

	// Insert transactions with categories (skip duplicates if marked)
	var savedCount int
	var skippedCount int

	for _, tx := range req.Transactions {
		// Skip duplicates
		if tx.IsDuplicate {
			skippedCount++
			continue
		}

		var catID *int
		if tx.CategoryID > 0 {
			catID = &tx.CategoryID
		}

		_, err := database.DB.Exec(
			`INSERT INTO transactions (user_id, account_id, category_id, description, detail, amount, type, date, source, raw_text)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'import', $9)`,
			userID, req.AccountID, catID, tx.Description, tx.Detail, tx.Amount, tx.Type, tx.Date, tx.RawText,
		)
		if err == nil {
			savedCount++
		}
	}

	// Update import record
	database.DB.Exec(
		`UPDATE imports SET status = 'completed', processed_transactions = $1 WHERE id = $2`,
		savedCount, req.ImportID,
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Transactions saved successfully",
		"saved":   savedCount,
		"skipped": skippedCount,
		"total":   len(req.Transactions),
	})
}

func GetImports(c *gin.Context) {
	userID := c.GetInt("user_id")

	rows, err := database.DB.Query(`
		SELECT id, filename, file_type, status, total_transactions, processed_transactions, created_at
		FROM imports
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 20
	`, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching imports"})
		return
	}
	defer rows.Close()

	var imports []map[string]interface{}
	for rows.Next() {
		var imp struct {
			ID                    int
			Filename              string
			FileType              string
			Status                string
			TotalTransactions     int
			ProcessedTransactions int
			CreatedAt             string
		}
		if err := rows.Scan(&imp.ID, &imp.Filename, &imp.FileType, &imp.Status, &imp.TotalTransactions, &imp.ProcessedTransactions, &imp.CreatedAt); err != nil {
			continue
		}
		imports = append(imports, map[string]interface{}{
			"id":                     imp.ID,
			"filename":               imp.Filename,
			"file_type":              imp.FileType,
			"status":                 imp.Status,
			"total_transactions":     imp.TotalTransactions,
			"processed_transactions": imp.ProcessedTransactions,
			"created_at":             imp.CreatedAt,
		})
	}

	if imports == nil {
		imports = []map[string]interface{}{}
	}

	c.JSON(http.StatusOK, imports)
}
