package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"github.com/warren/finance-app/internal/database"
	"github.com/warren/finance-app/internal/services"
)

// TransactionWithSuggestion includes parsed transaction with tag suggestions
type TransactionWithSuggestion struct {
	Description      string  `json:"description"`
	Detail           *string `json:"detail"`
	Amount           float64 `json:"amount"`
	Currency         string  `json:"currency"`
	Type             string  `json:"type"`
	Date             string  `json:"date"`
	RawText          string  `json:"raw_text"`
	SuggestedTagIDs  []int   `json:"suggested_tag_ids"`
	SuggestedDetail  *string `json:"suggested_detail"`
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

// enhanceTransactionsWithSuggestions checks for duplicates and suggests tags/details
// Optimized version: uses batch queries instead of per-transaction queries
func enhanceTransactionsWithSuggestions(userID int, transactions []services.ParsedTransaction) []TransactionWithSuggestion {
	if len(transactions) == 0 {
		return []TransactionWithSuggestion{}
	}

	result := make([]TransactionWithSuggestion, len(transactions))

	// Initialize all transactions
	for i, tx := range transactions {
		result[i] = TransactionWithSuggestion{
			Description:     tx.Description,
			Detail:          nil,
			Amount:          tx.Amount,
			Currency:        tx.Currency,
			Type:            tx.Type,
			Date:            tx.Date,
			RawText:         tx.RawText,
			IsDuplicate:     false,
			SuggestedTagIDs: []int{},
			SuggestedDetail: nil,
			ExistingTagIDs:  []int{},
		}
	}

	// Build a map for quick lookup of existing transactions (for duplicate detection)
	existingTxMap := loadExistingTransactions(userID, transactions)

	// Load suggestions based on exact description match (detail + tags)
	suggestionMap := loadSuggestionsByDescription(userID, transactions)

	// Process each transaction using the preloaded data
	for i, tx := range transactions {
		key := buildTxKey(tx.Description, tx.Amount, tx.Date)
		descKey := strings.ToLower(strings.TrimSpace(tx.Description))

		if existing, ok := existingTxMap[key]; ok {
			// Exact duplicate (same description, amount, date)
			result[i].IsDuplicate = true
			result[i].ExistingTagIDs = existing.TagIDs
			result[i].SuggestedTagIDs = existing.TagIDs
		} else {
			// Not a duplicate - look for suggestions based on description
			if suggestion, ok := suggestionMap[descKey]; ok {
				result[i].SuggestedTagIDs = suggestion.TagIDs
				result[i].SuggestedDetail = suggestion.Detail
			}
		}
	}

	return result
}

// existingTxInfo holds info about an existing transaction
type existingTxInfo struct {
	ID     int
	TagIDs []int
}

// buildTxKey creates a unique key for transaction matching
func buildTxKey(desc string, amount float64, date string) string {
	return strings.ToLower(strings.TrimSpace(desc)) + "|" + strconv.FormatFloat(amount, 'f', 2, 64) + "|" + date
}

// loadExistingTransactions loads all potentially duplicate transactions in one query
func loadExistingTransactions(userID int, transactions []services.ParsedTransaction) map[string]existingTxInfo {
	result := make(map[string]existingTxInfo)

	if len(transactions) == 0 {
		return result
	}

	// Get date range from transactions
	var minDate, maxDate string
	for _, tx := range transactions {
		if minDate == "" || tx.Date < minDate {
			minDate = tx.Date
		}
		if maxDate == "" || tx.Date > maxDate {
			maxDate = tx.Date
		}
	}

	// Query all transactions in date range with their tags
	rows, err := database.DB.Query(`
		SELECT t.id, LOWER(TRIM(t.description)), ROUND(t.amount::numeric, 2), t.date::text,
		       COALESCE(array_agg(tt.tag_id) FILTER (WHERE tt.tag_id IS NOT NULL), ARRAY[]::int[])
		FROM transactions t
		LEFT JOIN transaction_tags tt ON t.id = tt.transaction_id
		WHERE t.user_id = $1 AND t.date BETWEEN $2::date AND $3::date
		GROUP BY t.id, t.description, t.amount, t.date
	`, userID, minDate, maxDate)

	if err != nil {
		return result
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var desc string
		var amount float64
		var date string
		var tagIDs pq.Int64Array

		if err := rows.Scan(&id, &desc, &amount, &date, &tagIDs); err != nil {
			continue
		}

		key := desc + "|" + strconv.FormatFloat(amount, 'f', 2, 64) + "|" + date
		intTagIDs := make([]int, len(tagIDs))
		for i, tid := range tagIDs {
			intTagIDs[i] = int(tid)
		}
		result[key] = existingTxInfo{ID: id, TagIDs: intTagIDs}
	}

	return result
}

// suggestionInfo holds detail and tag suggestions for a description
type suggestionInfo struct {
	Detail *string
	TagIDs []int
}

// loadSuggestionsByDescription loads suggestions based on exact description match
// Returns detail and tags from previous transactions with the same description
func loadSuggestionsByDescription(userID int, transactions []services.ParsedTransaction) map[string]suggestionInfo {
	result := make(map[string]suggestionInfo)

	if len(transactions) == 0 {
		return result
	}

	// Get unique descriptions from incoming transactions
	descriptions := make([]string, 0)
	seen := make(map[string]bool)
	for _, tx := range transactions {
		descLower := strings.ToLower(strings.TrimSpace(tx.Description))
		if !seen[descLower] {
			seen[descLower] = true
			descriptions = append(descriptions, descLower)
		}
	}

	// Query the most recent transaction for each description that has detail or tags
	// We want to get the detail and tags from existing transactions with same description
	rows, err := database.DB.Query(`
		WITH ranked AS (
			SELECT
				LOWER(TRIM(t.description)) as desc_key,
				t.detail,
				COALESCE(array_agg(tt.tag_id) FILTER (WHERE tt.tag_id IS NOT NULL), ARRAY[]::int[]) as tag_ids,
				ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(t.description)) ORDER BY t.created_at DESC) as rn
			FROM transactions t
			LEFT JOIN transaction_tags tt ON t.id = tt.transaction_id
			WHERE t.user_id = $1
			  AND (t.detail IS NOT NULL AND t.detail != '' OR EXISTS (
			      SELECT 1 FROM transaction_tags tt2 WHERE tt2.transaction_id = t.id
			  ))
			GROUP BY t.id, t.description, t.detail, t.created_at
		)
		SELECT desc_key, detail, tag_ids
		FROM ranked
		WHERE rn = 1
	`, userID)

	if err != nil {
		return result
	}
	defer rows.Close()

	for rows.Next() {
		var descKey string
		var detail *string
		var tagIDs pq.Int64Array

		if err := rows.Scan(&descKey, &detail, &tagIDs); err != nil {
			continue
		}

		intTagIDs := make([]int, len(tagIDs))
		for i, tid := range tagIDs {
			intTagIDs[i] = int(tid)
		}

		result[descKey] = suggestionInfo{
			Detail: detail,
			TagIDs: intTagIDs,
		}
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

	// Filter out duplicates first
	var toInsert []struct {
		Description string
		Detail      *string
		Amount      float64
		Currency    string
		Type        string
		Date        string
		TagIDs      []int
		RawText     string
	}

	skippedCount := 0
	for _, tx := range req.Transactions {
		if tx.IsDuplicate {
			skippedCount++
			continue
		}
		currency := tx.Currency
		if currency == "" {
			currency = "PEN"
		}
		toInsert = append(toInsert, struct {
			Description string
			Detail      *string
			Amount      float64
			Currency    string
			Type        string
			Date        string
			TagIDs      []int
			RawText     string
		}{
			Description: tx.Description,
			Detail:      tx.Detail,
			Amount:      tx.Amount,
			Currency:    currency,
			Type:        tx.Type,
			Date:        tx.Date,
			TagIDs:      tx.TagIDs,
			RawText:     tx.RawText,
		})
	}

	if len(toInsert) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message": "No transactions to save",
			"saved":   0,
			"skipped": skippedCount,
			"total":   len(req.Transactions),
		})
		return
	}

	// Use a database transaction for atomicity
	dbTx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error starting transaction"})
		return
	}
	defer dbTx.Rollback()

	// Get valid tag IDs for this user (to avoid per-insert validation)
	validTagRows, err := database.DB.Query(`SELECT id FROM tags WHERE user_id = $1`, userID)
	validTags := make(map[int]bool)
	if err == nil {
		defer validTagRows.Close()
		for validTagRows.Next() {
			var tagID int
			if err := validTagRows.Scan(&tagID); err == nil {
				validTags[tagID] = true
			}
		}
	}

	// Insert all transactions and collect their IDs
	savedCount := 0
	type txWithTags struct {
		ID     int
		TagIDs []int
	}
	var insertedTxs []txWithTags

	for _, tx := range toInsert {
		var txID int
		err := dbTx.QueryRow(
			`INSERT INTO transactions (user_id, account_id, description, detail, amount, currency, type, date, source, raw_text)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'import', $9)
			 RETURNING id`,
			userID, req.AccountID, tx.Description, tx.Detail, tx.Amount, tx.Currency, tx.Type, tx.Date, tx.RawText,
		).Scan(&txID)

		if err == nil {
			savedCount++
			if len(tx.TagIDs) > 0 {
				insertedTxs = append(insertedTxs, txWithTags{ID: txID, TagIDs: tx.TagIDs})
			}
		}
	}

	// Batch insert all transaction_tags
	if len(insertedTxs) > 0 {
		for _, itx := range insertedTxs {
			for _, tagID := range itx.TagIDs {
				if validTags[tagID] {
					dbTx.Exec(`INSERT INTO transaction_tags (transaction_id, tag_id) VALUES ($1, $2)`,
						itx.ID, tagID)
				}
			}
		}
	}

	if err := dbTx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error saving transactions"})
		return
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
