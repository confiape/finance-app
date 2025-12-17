package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/warren/finance-app/internal/database"
	"github.com/warren/finance-app/internal/models"
)

func GetCategories(c *gin.Context) {
	userID := c.GetInt("user_id")
	txType := c.Query("type")
	flat := c.Query("flat") == "true" // If flat=true, return all categories without hierarchy

	query := `
		SELECT id, user_id, parent_id, name, type, color, icon, is_default, created_at
		FROM categories
		WHERE user_id = $1
	`
	args := []interface{}{userID}

	if txType != "" {
		query += " AND type = $2"
		args = append(args, txType)
	}

	query += " ORDER BY parent_id NULLS FIRST, name ASC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching categories"})
		return
	}
	defer rows.Close()

	var allCategories []models.Category
	for rows.Next() {
		var cat models.Category
		err := rows.Scan(&cat.ID, &cat.UserID, &cat.ParentID, &cat.Name, &cat.Type, &cat.Color, &cat.Icon, &cat.IsDefault, &cat.CreatedAt)
		if err != nil {
			continue
		}
		allCategories = append(allCategories, cat)
	}

	if allCategories == nil {
		allCategories = []models.Category{}
	}

	// If flat mode, return all categories as is
	if flat {
		c.JSON(http.StatusOK, allCategories)
		return
	}

	// Build hierarchy: parent categories with subcategories nested
	categoryMap := make(map[int]*models.Category)
	var rootCategories []models.Category

	// First pass: index all categories
	for i := range allCategories {
		categoryMap[allCategories[i].ID] = &allCategories[i]
	}

	// Second pass: build hierarchy
	for i := range allCategories {
		cat := &allCategories[i]
		if cat.ParentID == nil {
			// Root category
			rootCategories = append(rootCategories, *cat)
		} else {
			// Subcategory - add to parent
			if parent, ok := categoryMap[*cat.ParentID]; ok {
				parent.Subcategories = append(parent.Subcategories, *cat)
			}
		}
	}

	// Update root categories with their subcategories
	for i := range rootCategories {
		if updated, ok := categoryMap[rootCategories[i].ID]; ok {
			rootCategories[i].Subcategories = updated.Subcategories
		}
	}

	c.JSON(http.StatusOK, rootCategories)
}

func CreateCategory(c *gin.Context) {
	userID := c.GetInt("user_id")

	var req struct {
		Name     string `json:"name" binding:"required"`
		Type     string `json:"type" binding:"required,oneof=income expense"`
		Color    string `json:"color"`
		Icon     string `json:"icon"`
		ParentID *int   `json:"parent_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Color == "" {
		req.Color = "#6366f1"
	}
	if req.Icon == "" {
		req.Icon = "category"
	}

	// Validate parent_id if provided
	if req.ParentID != nil {
		var parentExists bool
		database.DB.QueryRow(
			"SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1 AND user_id = $2 AND parent_id IS NULL)",
			*req.ParentID, userID,
		).Scan(&parentExists)
		if !parentExists {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Parent category not found or is not a root category"})
			return
		}
	}

	var cat models.Category
	err := database.DB.QueryRow(
		`INSERT INTO categories (user_id, name, type, color, icon, parent_id)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, user_id, parent_id, name, type, color, icon, is_default, created_at`,
		userID, req.Name, req.Type, req.Color, req.Icon, req.ParentID,
	).Scan(&cat.ID, &cat.UserID, &cat.ParentID, &cat.Name, &cat.Type, &cat.Color, &cat.Icon, &cat.IsDefault, &cat.CreatedAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating category"})
		return
	}

	c.JSON(http.StatusCreated, cat)
}

func UpdateCategory(c *gin.Context) {
	userID := c.GetInt("user_id")
	catID := c.Param("id")

	var req struct {
		Name     string `json:"name" binding:"required"`
		Color    string `json:"color"`
		Icon     string `json:"icon"`
		ParentID *int   `json:"parent_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var cat models.Category
	err := database.DB.QueryRow(
		`UPDATE categories
		 SET name = $1, color = COALESCE(NULLIF($2, ''), color), icon = COALESCE(NULLIF($3, ''), icon), parent_id = $4
		 WHERE id = $5 AND user_id = $6
		 RETURNING id, user_id, parent_id, name, type, color, icon, is_default, created_at`,
		req.Name, req.Color, req.Icon, req.ParentID, catID, userID,
	).Scan(&cat.ID, &cat.UserID, &cat.ParentID, &cat.Name, &cat.Type, &cat.Color, &cat.Icon, &cat.IsDefault, &cat.CreatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
		return
	}

	c.JSON(http.StatusOK, cat)
}

func DeleteCategory(c *gin.Context) {
	userID := c.GetInt("user_id")
	catID := c.Param("id")

	result, err := database.DB.Exec(
		"DELETE FROM categories WHERE id = $1 AND user_id = $2",
		catID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting category"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Category deleted"})
}
