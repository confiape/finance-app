package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"github.com/warren/finance-app/internal/database"
	"github.com/warren/finance-app/internal/models"
)

func GetDashboard(c *gin.Context) {
	userID := c.GetInt("user_id")

	// Get date range (default: current month)
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	accountType := c.Query("account_type")
	includeLinked := c.Query("include_linked") == "true" // Default: false (show net amounts)

	if startDate == "" {
		now := time.Now()
		startDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	var summary models.DashboardSummary

	// Build account type filter
	accountTypeFilter := ""
	if accountType != "" {
		accountTypeFilter = " AND a.account_type = '" + accountType + "'"
	}

	// Build linked filter - when not including linked, we calculate net amounts
	// For linked transactions: we only count the difference (expense - reimbursement)
	// We process linked pairs by only counting the expense side with adjusted amount
	var totalsQuery string
	if includeLinked {
		// Show all transactions at full value
		totalsQuery = `
			SELECT
				COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
				COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense,
				COUNT(*) as transaction_count
			FROM transactions t
			LEFT JOIN accounts a ON t.account_id = a.id
			WHERE t.user_id = $1 AND t.date BETWEEN $2 AND $3` + accountTypeFilter
	} else {
		// Show net amounts for linked transactions
		// For unlinked: count normally
		// For linked pairs: only count the net difference (expense - income)
		// We handle this by: unlinked transactions + (expense amount - linked income amount) for linked pairs
		totalsQuery = `
			WITH linked_pairs AS (
				-- Get all linked expense transactions with their reimbursement
				SELECT
					e.id as expense_id,
					e.amount as expense_amount,
					i.amount as income_amount,
					e.currency as currency,
					GREATEST(e.amount - i.amount, 0) as net_expense,
					GREATEST(i.amount - e.amount, 0) as net_income
				FROM transactions e
				JOIN transactions i ON e.linked_to = i.id
				WHERE e.user_id = $1
				  AND e.type = 'expense'
				  AND i.type = 'income'
				  AND e.date BETWEEN $2 AND $3
			),
			unlinked AS (
				-- Get unlinked transactions
				SELECT t.type, t.amount
				FROM transactions t
				LEFT JOIN accounts a ON t.account_id = a.id
				WHERE t.user_id = $1
				  AND t.date BETWEEN $2 AND $3
				  AND t.linked_to IS NULL` + accountTypeFilter + `
			)
			SELECT
				COALESCE((SELECT SUM(amount) FROM unlinked WHERE type = 'income'), 0) +
				COALESCE((SELECT SUM(net_income) FROM linked_pairs), 0) as total_income,
				COALESCE((SELECT SUM(amount) FROM unlinked WHERE type = 'expense'), 0) +
				COALESCE((SELECT SUM(net_expense) FROM linked_pairs), 0) as total_expense,
				(SELECT COUNT(*) FROM unlinked) +
				(SELECT COUNT(*) FROM linked_pairs WHERE net_expense > 0 OR net_income > 0) as transaction_count`
	}

	err := database.DB.QueryRow(totalsQuery, userID, startDate, endDate).Scan(&summary.TotalIncome, &summary.TotalExpense, &summary.TransactionCount)

	if err != nil {
		log.Printf("Error fetching dashboard summary: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching summary", "details": err.Error()})
		return
	}

	summary.Balance = summary.TotalIncome - summary.TotalExpense

	// Get breakdown by tag - group by tag AND type so each tag can appear once per transaction type
	// Also calculate totals by currency (PEN and USD)
	// When not including linked, exclude fully linked transactions from tag summary
	linkedFilter := ""
	if !includeLinked {
		linkedFilter = " AND t.linked_to IS NULL"
	}

	tagQuery := `
		SELECT
			tg.id, tg.name, tg.color,
			COALESCE(SUM(t.amount), 0) as total,
			COALESCE(SUM(CASE WHEN t.currency = 'PEN' THEN t.amount ELSE 0 END), 0) as total_pen,
			COALESCE(SUM(CASE WHEN t.currency = 'USD' THEN t.amount ELSE 0 END), 0) as total_usd,
			COUNT(DISTINCT t.id) as count,
			t.type
		FROM tags tg
		JOIN transaction_tags tt ON tg.id = tt.tag_id
		JOIN transactions t ON tt.transaction_id = t.id
		LEFT JOIN accounts a ON t.account_id = a.id
		WHERE tg.user_id = $1 AND t.date BETWEEN $2 AND $3` + accountTypeFilter + linkedFilter + `
		GROUP BY tg.id, tg.name, tg.color, t.type
		HAVING COUNT(DISTINCT t.id) > 0
		ORDER BY total DESC`
	rows, err := database.DB.Query(tagQuery, userID, startDate, endDate)

	if err != nil {
		log.Printf("Error fetching tag summary: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching tag summary", "details": err.Error()})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var ts models.TagSummary
		if err := rows.Scan(&ts.TagID, &ts.TagName, &ts.Color, &ts.Total, &ts.TotalPEN, &ts.TotalUSD, &ts.Count, &ts.Type); err != nil {
			continue
		}
		summary.ByTag = append(summary.ByTag, ts)
	}

	if summary.ByTag == nil {
		summary.ByTag = []models.TagSummary{}
	}

	// Get recent transactions (when not including linked, filter them out)
	recentQuery := `
		SELECT t.id, t.user_id, t.description, t.detail, t.amount, t.currency, t.type,
		       t.date, t.source, t.linked_to, t.created_at, t.updated_at
		FROM transactions t
		LEFT JOIN accounts a ON t.account_id = a.id
		WHERE t.user_id = $1 AND t.date BETWEEN $2 AND $3` + accountTypeFilter + linkedFilter + `
		ORDER BY t.date DESC, t.created_at DESC
		LIMIT 10`
	recentRows, err := database.DB.Query(recentQuery, userID, startDate, endDate)

	if err != nil {
		log.Printf("Error fetching recent transactions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching recent transactions", "details": err.Error()})
		return
	}
	defer recentRows.Close()

	transactionIDs := []int{}
	for recentRows.Next() {
		var t models.Transaction
		if err := recentRows.Scan(
			&t.ID, &t.UserID, &t.Description, &t.Detail, &t.Amount, &t.Currency, &t.Type,
			&t.Date, &t.Source, &t.LinkedTo, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			continue
		}
		t.Tags = []models.Tag{}
		summary.RecentTx = append(summary.RecentTx, t)
		transactionIDs = append(transactionIDs, t.ID)
	}

	// Fetch tags for recent transactions
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
			for i := range summary.RecentTx {
				if tags, ok := tagMap[summary.RecentTx[i].ID]; ok {
					summary.RecentTx[i].Tags = tags
				}
			}
		}
	}

	if summary.RecentTx == nil {
		summary.RecentTx = []models.Transaction{}
	}

	c.JSON(http.StatusOK, summary)
}
