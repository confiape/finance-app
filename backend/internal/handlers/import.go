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

// TransactionWithSuggestion includes parsed transaction with tag suggestions
type TransactionWithSuggestion struct {
	Description      string `json:"description"`
	Amount           float64 `json:"amount"`
	Currency         string  `json:"currency"`
	Type             string  `json:"type"`
	Date             string  `json:"date"`
	RawText          string  `json:"raw_text"`
	SuggestedTagIDs  []int   `json:"suggested_tag_ids"`
	IsDuplicate      bool    `json:"is_duplicate"`
	ExistingTagIDs   []int   `json:"existing_tag_ids"`
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

// enhanceTransactionsWithSuggestions checks for duplicates and suggests tags
func enhanceTransactionsWithSuggestions(userID int, transactions []services.ParsedTransaction) []TransactionWithSuggestion {
	result := make([]TransactionWithSuggestion, 0, len(transactions))

	for _, tx := range transactions {
		enhanced := TransactionWithSuggestion{
			Description:     tx.Description,
			Amount:          tx.Amount,
			Currency:        tx.Currency,
			Type:            tx.Type,
			Date:            tx.Date,
			RawText:         tx.RawText,
			IsDuplicate:     false,
			SuggestedTagIDs: []int{},
			ExistingTagIDs:  []int{},
		}

		// Check if exact transaction exists (same description, amount, date)
		var existingID int
		err := database.DB.QueryRow(`
			SELECT id FROM transactions
			WHERE user_id = $1
			AND LOWER(TRIM(description)) = LOWER(TRIM($2))
			AND ROUND(amount::numeric, 2) = ROUND($3::numeric, 2)
			AND date = $4::date
			LIMIT 1
		`, userID, tx.Description, tx.Amount, tx.Date).Scan(&existingID)

		if err == nil {
			// Transaction exists - it's a duplicate
			enhanced.IsDuplicate = true
			enhanced.ExistingTagIDs = getTagsForTransaction(existingID)
			enhanced.SuggestedTagIDs = enhanced.ExistingTagIDs
		} else {
			// Try fuzzy match
			descPrefix := extractDescriptionPrefix(tx.Description)
			if descPrefix != "" {
				err = database.DB.QueryRow(`
					SELECT id FROM transactions
					WHERE user_id = $1
					AND ROUND(amount::numeric, 2) = ROUND($2::numeric, 2)
					AND date = $3::date
					AND (
						LOWER(description) LIKE $4
						OR LOWER(description) LIKE $5
					)
					LIMIT 1
				`, userID, tx.Amount, tx.Date, "%"+descPrefix+"%", descPrefix+"%").Scan(&existingID)

				if err == nil {
					enhanced.IsDuplicate = true
					enhanced.ExistingTagIDs = getTagsForTransaction(existingID)
					enhanced.SuggestedTagIDs = enhanced.ExistingTagIDs
				}
			}

			// Check for split transactions
			if !enhanced.IsDuplicate {
				var totalAmount float64
				var firstTxID *int
				err = database.DB.QueryRow(`
					SELECT COALESCE(SUM(amount), 0), (SELECT id FROM transactions
						WHERE user_id = $1 AND LOWER(TRIM(description)) = LOWER(TRIM($2)) AND date = $3::date LIMIT 1)
					FROM transactions
					WHERE user_id = $1
					AND LOWER(TRIM(description)) = LOWER(TRIM($2))
					AND date = $3::date
				`, userID, tx.Description, tx.Date).Scan(&totalAmount, &firstTxID)

				if err == nil && totalAmount > 0 {
					diff := tx.Amount - totalAmount
					if diff >= -0.01 && diff <= 0.01 {
						enhanced.IsDuplicate = true
						if firstTxID != nil {
							enhanced.ExistingTagIDs = getTagsForTransaction(*firstTxID)
							enhanced.SuggestedTagIDs = enhanced.ExistingTagIDs
						}
					}
				}
			}
		}

		// If no tags found, try to suggest some
		if len(enhanced.SuggestedTagIDs) == 0 {
			suggestedTags := findTagSuggestions(userID, tx.Description, tx.Type)
			enhanced.SuggestedTagIDs = suggestedTags
		}

		result = append(result, enhanced)
	}

	return result
}

// getTagsForTransaction returns tag IDs for a transaction
func getTagsForTransaction(transactionID int) []int {
	rows, err := database.DB.Query(`
		SELECT tag_id FROM transaction_tags WHERE transaction_id = $1
	`, transactionID)
	if err != nil {
		return []int{}
	}
	defer rows.Close()

	var tagIDs []int
	for rows.Next() {
		var tagID int
		if err := rows.Scan(&tagID); err == nil {
			tagIDs = append(tagIDs, tagID)
		}
	}
	if tagIDs == nil {
		return []int{}
	}
	return tagIDs
}

// extractDescriptionPrefix extracts a meaningful prefix from description for fuzzy matching
// e.g., "MDOPAGO*MERCADO PAGO" -> "mdopago"
// e.g., "(P) PAGO WEB DESACOPL" -> "pago"
func extractDescriptionPrefix(desc string) string {
	desc = strings.ToLower(strings.TrimSpace(desc))

	// Remove common prefixes like "(P)" or "(C)"
	if strings.HasPrefix(desc, "(") {
		idx := strings.Index(desc, ")")
		if idx > 0 && idx < 5 {
			desc = strings.TrimSpace(desc[idx+1:])
		}
	}

	// Get first word (split by space or special chars)
	words := strings.FieldsFunc(desc, func(r rune) bool {
		return r == ' ' || r == '*' || r == '-' || r == '_' || r == '.'
	})

	if len(words) == 0 {
		return ""
	}

	// Return first significant word (at least 4 chars)
	for _, word := range words {
		if len(word) >= 4 {
			return word
		}
	}

	return words[0]
}

// findTagSuggestions finds tags based on similar past transactions
func findTagSuggestions(userID int, description string, txType string) []int {
	// Normalize description for comparison
	descLower := strings.ToLower(description)

	// Extract key words from description (first word usually identifies the merchant)
	words := strings.Fields(descLower)
	if len(words) == 0 {
		return []int{}
	}

	// Try to find exact match first
	var txID int
	err := database.DB.QueryRow(`
		SELECT t.id FROM transactions t
		JOIN transaction_tags tt ON t.id = tt.transaction_id
		WHERE t.user_id = $1 AND LOWER(t.description) = $2
		ORDER BY t.created_at DESC
		LIMIT 1
	`, userID, descLower).Scan(&txID)

	if err == nil {
		return getTagsForTransaction(txID)
	}

	// Try to find by first word (merchant name)
	firstWord := words[0]
	if len(firstWord) >= 3 {
		err = database.DB.QueryRow(`
			SELECT t.id FROM transactions t
			JOIN transaction_tags tt ON t.id = tt.transaction_id
			WHERE t.user_id = $1 AND LOWER(t.description) LIKE $2 AND t.type = $3
			ORDER BY t.created_at DESC
			LIMIT 1
		`, userID, firstWord+"%", txType).Scan(&txID)

		if err == nil {
			return getTagsForTransaction(txID)
		}
	}

	// Try partial match with any significant word
	for _, word := range words {
		if len(word) >= 4 {
			err = database.DB.QueryRow(`
				SELECT t.id FROM transactions t
				JOIN transaction_tags tt ON t.id = tt.transaction_id
				WHERE t.user_id = $1 AND LOWER(t.description) LIKE $2 AND t.type = $3
				ORDER BY t.created_at DESC
				LIMIT 1
			`, userID, "%"+word+"%", txType).Scan(&txID)

			if err == nil {
				return getTagsForTransaction(txID)
			}
		}
	}

	return []int{}
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
			Currency    string  `json:"currency"`
			Type        string  `json:"type"`
			Date        string  `json:"date"`
			TagIDs      []int   `json:"tag_ids"`
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

	// Insert transactions with tags (skip duplicates if marked)
	var savedCount int
	var skippedCount int

	for _, tx := range req.Transactions {
		// Skip duplicates
		if tx.IsDuplicate {
			skippedCount++
			continue
		}

		// Default currency to PEN if not specified
		currency := tx.Currency
		if currency == "" {
			currency = "PEN"
		}

		var txID int
		err := database.DB.QueryRow(
			`INSERT INTO transactions (user_id, account_id, description, detail, amount, currency, type, date, source, raw_text)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'import', $9)
			 RETURNING id`,
			userID, req.AccountID, tx.Description, tx.Detail, tx.Amount, currency, tx.Type, tx.Date, tx.RawText,
		).Scan(&txID)

		if err == nil {
			savedCount++
			// Insert tags for this transaction
			for _, tagID := range tx.TagIDs {
				database.DB.Exec(`
					INSERT INTO transaction_tags (transaction_id, tag_id)
					SELECT $1, $2
					WHERE EXISTS (SELECT 1 FROM tags WHERE id = $2 AND user_id = $3)
				`, txID, tagID, userID)
			}
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
