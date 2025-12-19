package services

import (
	"regexp"
	"strings"
)

// BankConfig defines how to parse Excel files from different banks
type BankConfig struct {
	Name           string
	HeaderRow      int    // Row where headers are (0-indexed)
	DateCol        int    // Column index for date
	DescriptionCol int    // Column index for description
	AmountCol      int    // Column index for amount
	DateFormat     string // Expected date format
	CurrencySymbol string // Currency symbol to remove (e.g., "S/", "$")
}

// Available bank configurations
var BankConfigs = map[string]BankConfig{
	"bbva": {
		Name:           "BBVA",
		HeaderRow:      4,  // Row 5 in Excel (0-indexed = 4)
		DateCol:        1,  // Column B
		DescriptionCol: 2,  // Column C
		AmountCol:      5,  // Column F
		DateFormat:     "dd/mm/yyyy",
		CurrencySymbol: "S/",
	},
	"generic": {
		Name:           "Genérico",
		HeaderRow:      0,
		DateCol:        0,
		DescriptionCol: 1,
		AmountCol:      2,
		DateFormat:     "auto",
		CurrencySymbol: "",
	},
}

// GetSupportedBanks returns list of supported banks
func GetSupportedBanks() []map[string]string {
	banks := []map[string]string{
		{"id": "bbva", "name": "BBVA"},
		{"id": "generic", "name": "Genérico (auto-detectar)"},
	}
	return banks
}

// ParseBBVAAmount parses BBVA amount format: "S/ -30.00", "S/ 3,100.00", "US$ 108.09"
// Returns: amount, type (income/expense), currency (PEN/USD)
func ParseBBVAAmount(amountStr string) (float64, string, string) {
	amountStr = strings.TrimSpace(amountStr)

	// Detect currency before removing symbols
	currency := "PEN" // Default to Peruvian Sol
	if strings.Contains(amountStr, "US$") || strings.Contains(amountStr, "USD") || strings.Contains(amountStr, "US ") {
		currency = "USD"
	}

	// Remove currency symbols
	amountStr = strings.ReplaceAll(amountStr, "S/", "")
	amountStr = strings.ReplaceAll(amountStr, "US$", "")
	amountStr = strings.ReplaceAll(amountStr, "USD", "")
	amountStr = strings.ReplaceAll(amountStr, "$", "")
	amountStr = strings.TrimSpace(amountStr)

	amount, txType := parseAmount(amountStr)
	return amount, txType, currency
}

// ParseBBVADate parses BBVA date format: "16/12/2025"
func ParseBBVADate(dateStr string) string {
	dateStr = strings.TrimSpace(dateStr)
	if dateStr == "" {
		return ""
	}

	// Try dd/mm/yyyy format
	parts := regexp.MustCompile(`(\d{1,2})/(\d{1,2})/(\d{4})`).FindStringSubmatch(dateStr)
	if len(parts) == 4 {
		day := parts[1]
		month := parts[2]
		year := parts[3]

		// Pad with zeros if needed
		if len(day) == 1 {
			day = "0" + day
		}
		if len(month) == 1 {
			month = "0" + month
		}

		return year + "-" + month + "-" + day
	}

	return parseDate(dateStr)
}

// ParseRowByBank parses a row based on bank configuration
func ParseRowByBank(row []string, bankID string) *ParsedTransaction {
	config, exists := BankConfigs[bankID]
	if !exists {
		config = BankConfigs["generic"]
	}

	// Check if row has enough columns
	maxCol := max(config.DateCol, config.DescriptionCol, config.AmountCol)
	if len(row) <= maxCol {
		return nil
	}

	dateStr := safeGet(row, config.DateCol)
	description := safeGet(row, config.DescriptionCol)
	amountStr := safeGet(row, config.AmountCol)

	// Skip empty rows or header rows
	if dateStr == "" || description == "" || amountStr == "" {
		return nil
	}

	// Skip if it looks like a header
	descLower := strings.ToLower(description)
	if descLower == "descripción" || descLower == "descripcion" || descLower == "description" {
		return nil
	}

	var date string
	var amount float64
	var txType string
	var currency string

	switch bankID {
	case "bbva":
		date = ParseBBVADate(dateStr)
		amount, txType, currency = ParseBBVAAmount(amountStr)
	default:
		date = parseDate(dateStr)
		amount, txType = parseAmount(amountStr)
		currency = "PEN" // Default for generic parser
	}

	if date == "" || amount == 0 {
		return nil
	}

	return &ParsedTransaction{
		Date:        date,
		Description: strings.TrimSpace(description),
		Amount:      amount,
		Currency:    currency,
		Type:        txType,
		RawText:     strings.Join(row, " | "),
	}
}

func max(nums ...int) int {
	m := nums[0]
	for _, n := range nums {
		if n > m {
			m = n
		}
	}
	return m
}
