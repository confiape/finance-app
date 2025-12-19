package services

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/extrame/xls"
	"github.com/warren/finance-app/internal/database"
	"github.com/xuri/excelize/v2"
)

type ParsedTransaction struct {
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"` // PEN, USD
	Type        string  `json:"type"`
	Date        string  `json:"date"`
	RawText     string  `json:"raw_text"`
}

// ProcessExcelFile reads and parses an Excel file for bank transactions
// invertSigns should be true for credit card accounts where signs are inverted
func ProcessExcelFile(filePath string, userID int, bankID string, invertSigns bool) ([]ParsedTransaction, int, error) {
	ext := strings.ToLower(filepath.Ext(filePath))

	var rows [][]string
	var err error

	// Use different library based on file extension
	if ext == ".xls" {
		rows, err = readXLSFile(filePath)
	} else {
		rows, err = readXLSXFile(filePath)
	}

	if err != nil {
		return nil, 0, err
	}

	// Create import record
	var importID int
	err = database.DB.QueryRow(
		`INSERT INTO imports (user_id, filename, file_type, status, total_transactions)
		 VALUES ($1, $2, 'excel', 'processing', $3) RETURNING id`,
		userID, filePath, len(rows),
	).Scan(&importID)
	if err != nil {
		return nil, 0, fmt.Errorf("error creating import record: %w", err)
	}

	// Parse based on bank
	var transactions []ParsedTransaction

	if bankID == "" || bankID == "generic" {
		transactions = detectAndParseExcel(rows)
	} else {
		transactions = parseExcelByBank(rows, bankID)
	}

	// Invert signs for credit card accounts (e.g., BBVA credit cards)
	// In credit card statements: purchases are positive, payments are negative
	// We need to flip them: purchases become expenses, payments become income
	if invertSigns {
		for i := range transactions {
			if transactions[i].Type == "income" {
				transactions[i].Type = "expense"
			} else {
				transactions[i].Type = "income"
			}
		}
	}

	// Update import status
	database.DB.Exec(
		`UPDATE imports SET status = 'completed', total_transactions = $1 WHERE id = $2`,
		len(transactions), importID,
	)

	return transactions, importID, nil
}

// readXLSXFile reads .xlsx files using excelize
func readXLSXFile(filePath string) ([][]string, error) {
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("error opening xlsx file: %w", err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("no sheets found in Excel file")
	}

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		return nil, fmt.Errorf("error reading rows: %w", err)
	}

	return rows, nil
}

// readXLSFile reads .xls files using extrame/xls
func readXLSFile(filePath string) ([][]string, error) {
	xlFile, err := xls.Open(filePath, "utf-8")
	if err != nil {
		return nil, fmt.Errorf("error opening xls file: %w", err)
	}

	sheet := xlFile.GetSheet(0)
	if sheet == nil {
		return nil, fmt.Errorf("no sheets found in xls file")
	}

	var rows [][]string
	maxRow := int(sheet.MaxRow)

	for i := 0; i <= maxRow; i++ {
		row := sheet.Row(i)
		if row == nil {
			continue
		}

		var cells []string
		lastCol := row.LastCol()

		for j := 0; j <= lastCol; j++ {
			cell := row.Col(j)
			cells = append(cells, cell)
		}

		rows = append(rows, cells)
	}

	return rows, nil
}

// parseExcelByBank parses Excel using bank-specific configuration
func parseExcelByBank(rows [][]string, bankID string) []ParsedTransaction {
	config, exists := BankConfigs[bankID]
	if !exists {
		return detectAndParseExcel(rows)
	}

	var transactions []ParsedTransaction

	// Start from the row after header
	startRow := config.HeaderRow + 1

	for i := startRow; i < len(rows); i++ {
		tx := ParseRowByBank(rows[i], bankID)
		if tx != nil {
			transactions = append(transactions, *tx)
		}
	}

	return transactions
}

func detectAndParseExcel(rows [][]string) []ParsedTransaction {
	if len(rows) < 2 {
		return nil
	}

	// Try to detect column positions from header
	header := rows[0]
	dateCol, descCol, amountCol, typeCol := -1, -1, -1, -1

	for i, col := range header {
		colLower := strings.ToLower(col)
		if containsAny(colLower, []string{"fecha", "date", "dia"}) {
			dateCol = i
		} else if containsAny(colLower, []string{"descripcion", "description", "concepto", "detalle"}) {
			descCol = i
		} else if containsAny(colLower, []string{"monto", "amount", "importe", "valor", "cargo", "abono"}) {
			amountCol = i
		} else if containsAny(colLower, []string{"tipo", "type", "movimiento"}) {
			typeCol = i
		}
	}

	// Default positions if not found
	if dateCol == -1 {
		dateCol = 0
	}
	if descCol == -1 {
		descCol = 1
	}
	if amountCol == -1 {
		amountCol = 2
	}

	var transactions []ParsedTransaction

	for i := 1; i < len(rows); i++ {
		row := rows[i]
		if len(row) <= amountCol {
			continue
		}

		tx := ParsedTransaction{
			Date:        parseDate(safeGet(row, dateCol)),
			Description: safeGet(row, descCol),
			RawText:     strings.Join(row, " | "),
		}

		// Parse amount
		amountStr := safeGet(row, amountCol)
		tx.Amount, tx.Type = parseAmount(amountStr)

		// Override type if column exists
		if typeCol != -1 && len(row) > typeCol {
			typeStr := strings.ToLower(safeGet(row, typeCol))
			if containsAny(typeStr, []string{"ingreso", "income", "abono", "deposito", "credito"}) {
				tx.Type = "income"
			} else if containsAny(typeStr, []string{"gasto", "expense", "cargo", "retiro", "debito"}) {
				tx.Type = "expense"
			}
		}

		if tx.Description != "" && tx.Amount != 0 {
			transactions = append(transactions, tx)
		}
	}

	return transactions
}

// ProcessImageFile parses text from an image (simplified without Tesseract)
func ProcessImageFile(filePath string, userID int) ([]ParsedTransaction, int, error) {
	var importID int
	err := database.DB.QueryRow(
		`INSERT INTO imports (user_id, filename, file_type, status)
		 VALUES ($1, $2, 'image', 'completed') RETURNING id`,
		userID, filePath,
	).Scan(&importID)
	if err != nil {
		return nil, 0, fmt.Errorf("error creating import record: %w", err)
	}

	return nil, importID, fmt.Errorf("OCR no disponible. Instala Tesseract: sudo apt-get install tesseract-ocr libtesseract-dev")
}

func parseOCRText(text string) []ParsedTransaction {
	var transactions []ParsedTransaction
	lines := strings.Split(text, "\n")

	datePattern := regexp.MustCompile(`(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})`)
	amountPattern := regexp.MustCompile(`\$?\s*([\d,]+\.?\d*)`)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if len(line) < 10 {
			continue
		}

		dateMatch := datePattern.FindString(line)
		if dateMatch == "" {
			continue
		}

		amounts := amountPattern.FindAllStringSubmatch(line, -1)
		if len(amounts) == 0 {
			continue
		}

		lastAmount := amounts[len(amounts)-1][1]
		amount, txType := parseAmount(lastAmount)

		if amount == 0 {
			continue
		}

		desc := line
		desc = datePattern.ReplaceAllString(desc, "")
		desc = amountPattern.ReplaceAllString(desc, "")
		desc = strings.TrimSpace(desc)

		if len(desc) < 3 {
			desc = "Transacción bancaria"
		}

		transactions = append(transactions, ParsedTransaction{
			Date:        parseDate(dateMatch),
			Description: desc,
			Amount:      amount,
			Type:        txType,
			RawText:     line,
		})
	}

	return transactions
}

// Helper functions
func safeGet(slice []string, index int) string {
	if index < len(slice) {
		return strings.TrimSpace(slice[index])
	}
	return ""
}

func containsAny(s string, substrs []string) bool {
	for _, sub := range substrs {
		if strings.Contains(s, sub) {
			return true
		}
	}
	return false
}

func parseDate(dateStr string) string {
	dateStr = strings.TrimSpace(dateStr)
	if dateStr == "" {
		return time.Now().Format("2006-01-02")
	}

	formats := []string{
		"2006-01-02",
		"02/01/2006",
		"01/02/2006",
		"02-01-2006",
		"01-02-2006",
		"2/1/2006",
		"1/2/2006",
		"02/01/06",
		"01/02/06",
	}

	for _, format := range formats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return t.Format("2006-01-02")
		}
	}

	return time.Now().Format("2006-01-02")
}

func parseAmount(amountStr string) (float64, string) {
	amountStr = strings.TrimSpace(amountStr)
	amountStr = strings.ReplaceAll(amountStr, "$", "")
	amountStr = strings.ReplaceAll(amountStr, ",", "")
	amountStr = strings.ReplaceAll(amountStr, " ", "")

	isNegative := strings.HasPrefix(amountStr, "-") || strings.HasPrefix(amountStr, "(")
	amountStr = strings.Trim(amountStr, "-()")

	amount, err := strconv.ParseFloat(amountStr, 64)
	if err != nil {
		return 0, "expense"
	}

	txType := "income"
	if isNegative || amount < 0 {
		txType = "expense"
		amount = abs(amount)
	}

	return amount, txType
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}

func SaveParsedTransactions(userID int, importID int, transactions []ParsedTransaction) error {
	for _, tx := range transactions {
		_, err := database.DB.Exec(
			`INSERT INTO transactions (user_id, description, amount, type, date, source, raw_text)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			userID, tx.Description, tx.Amount, tx.Type, tx.Date, "import", tx.RawText,
		)
		if err != nil {
			return err
		}
	}
	return nil
}
