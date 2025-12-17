package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/warren/finance-app/internal/database"
	"github.com/warren/finance-app/internal/models"
)

func GetDashboard(c *gin.Context) {
	userID := c.GetInt("user_id")

	// Get date range (default: current month)
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	if startDate == "" {
		now := time.Now()
		startDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
	}
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	var summary models.DashboardSummary

	// Get totals
	err := database.DB.QueryRow(`
		SELECT
			COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
			COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
			COUNT(*) as transaction_count
		FROM transactions
		WHERE user_id = $1 AND date BETWEEN $2 AND $3
	`, userID, startDate, endDate).Scan(&summary.TotalIncome, &summary.TotalExpense, &summary.TransactionCount)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching summary"})
		return
	}

	summary.Balance = summary.TotalIncome - summary.TotalExpense

	// Get breakdown by category
	rows, err := database.DB.Query(`
		SELECT
			c.id, c.name, c.color, c.type,
			COALESCE(SUM(t.amount), 0) as total,
			COUNT(t.id) as count
		FROM categories c
		LEFT JOIN transactions t ON t.category_id = c.id
			AND t.date BETWEEN $2 AND $3
		WHERE c.user_id = $1
		GROUP BY c.id, c.name, c.color, c.type
		HAVING COUNT(t.id) > 0
		ORDER BY total DESC
	`, userID, startDate, endDate)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching category summary"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var cs models.CategorySummary
		if err := rows.Scan(&cs.CategoryID, &cs.CategoryName, &cs.Color, &cs.Type, &cs.Total, &cs.Count); err != nil {
			continue
		}
		summary.ByCategory = append(summary.ByCategory, cs)
	}

	if summary.ByCategory == nil {
		summary.ByCategory = []models.CategorySummary{}
	}

	// Get recent transactions
	recentRows, err := database.DB.Query(`
		SELECT t.id, t.user_id, t.category_id, t.description, t.amount, t.type,
		       t.date, t.source, t.created_at, t.updated_at,
		       c.name, c.color
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.user_id = $1
		ORDER BY t.date DESC, t.created_at DESC
		LIMIT 10
	`, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching recent transactions"})
		return
	}
	defer recentRows.Close()

	for recentRows.Next() {
		var t models.Transaction
		var catName, catColor *string

		if err := recentRows.Scan(
			&t.ID, &t.UserID, &t.CategoryID, &t.Description, &t.Amount, &t.Type,
			&t.Date, &t.Source, &t.CreatedAt, &t.UpdatedAt,
			&catName, &catColor,
		); err != nil {
			continue
		}

		if catName != nil {
			t.Category = &models.Category{
				Name:  *catName,
				Color: *catColor,
			}
		}

		summary.RecentTx = append(summary.RecentTx, t)
	}

	if summary.RecentTx == nil {
		summary.RecentTx = []models.Transaction{}
	}

	c.JSON(http.StatusOK, summary)
}
