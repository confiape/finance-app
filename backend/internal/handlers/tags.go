package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/warren/finance-app/internal/database"
)

type Tag struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateTagRequest struct {
	Name  string `json:"name" binding:"required"`
	Color string `json:"color"`
}

type UpdateTagRequest struct {
	Name  string `json:"name" binding:"required"`
	Color string `json:"color"`
}

// GetTags returns all tags for the authenticated user
func GetTags(c *gin.Context) {
	userID := c.GetInt("user_id")

	rows, err := database.DB.Query(`
		SELECT id, user_id, name, color, created_at
		FROM tags
		WHERE user_id = $1
		ORDER BY name
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching tags"})
		return
	}
	defer rows.Close()

	tags := []Tag{}
	for rows.Next() {
		var tag Tag
		err := rows.Scan(&tag.ID, &tag.UserID, &tag.Name, &tag.Color, &tag.CreatedAt)
		if err != nil {
			continue
		}
		tags = append(tags, tag)
	}

	c.JSON(http.StatusOK, tags)
}

// GetTag returns a single tag
func GetTag(c *gin.Context) {
	userID := c.GetInt("user_id")
	tagID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tag ID"})
		return
	}

	var tag Tag
	err = database.DB.QueryRow(`
		SELECT id, user_id, name, color, created_at
		FROM tags
		WHERE id = $1 AND user_id = $2
	`, tagID, userID).Scan(&tag.ID, &tag.UserID, &tag.Name, &tag.Color, &tag.CreatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tag not found"})
		return
	}

	c.JSON(http.StatusOK, tag)
}

// CreateTag creates a new tag
func CreateTag(c *gin.Context) {
	userID := c.GetInt("user_id")

	var req CreateTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.Color == "" {
		req.Color = "#6366f1"
	}

	var tag Tag
	err := database.DB.QueryRow(`
		INSERT INTO tags (user_id, name, color)
		VALUES ($1, $2, $3)
		RETURNING id, user_id, name, color, created_at
	`, userID, req.Name, req.Color).Scan(&tag.ID, &tag.UserID, &tag.Name, &tag.Color, &tag.CreatedAt)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating tag"})
		return
	}

	c.JSON(http.StatusCreated, tag)
}

// UpdateTag updates an existing tag
func UpdateTag(c *gin.Context) {
	userID := c.GetInt("user_id")
	tagID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tag ID"})
		return
	}

	var req UpdateTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.Color == "" {
		req.Color = "#6366f1"
	}

	var tag Tag
	err = database.DB.QueryRow(`
		UPDATE tags
		SET name = $1, color = $2
		WHERE id = $3 AND user_id = $4
		RETURNING id, user_id, name, color, created_at
	`, req.Name, req.Color, tagID, userID).Scan(&tag.ID, &tag.UserID, &tag.Name, &tag.Color, &tag.CreatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tag not found"})
		return
	}

	c.JSON(http.StatusOK, tag)
}

// DeleteTag deletes a tag
func DeleteTag(c *gin.Context) {
	userID := c.GetInt("user_id")
	tagID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tag ID"})
		return
	}

	result, err := database.DB.Exec(`
		DELETE FROM tags
		WHERE id = $1 AND user_id = $2
	`, tagID, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error deleting tag"})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tag not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tag deleted"})
}

// GetTagsForTransaction returns all tags for a specific transaction
func GetTagsForTransaction(c *gin.Context) {
	userID := c.GetInt("user_id")
	transactionID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
		return
	}

	rows, err := database.DB.Query(`
		SELECT t.id, t.user_id, t.name, t.color, t.created_at
		FROM tags t
		JOIN transaction_tags tt ON t.id = tt.tag_id
		JOIN transactions tr ON tt.transaction_id = tr.id
		WHERE tt.transaction_id = $1 AND tr.user_id = $2
	`, transactionID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error fetching tags"})
		return
	}
	defer rows.Close()

	tags := []Tag{}
	for rows.Next() {
		var tag Tag
		err := rows.Scan(&tag.ID, &tag.UserID, &tag.Name, &tag.Color, &tag.CreatedAt)
		if err != nil {
			continue
		}
		tags = append(tags, tag)
	}

	c.JSON(http.StatusOK, tags)
}

// SetTransactionTags sets the tags for a transaction (replaces existing)
func SetTransactionTags(c *gin.Context) {
	userID := c.GetInt("user_id")
	transactionID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction ID"})
		return
	}

	var req struct {
		TagIDs []int `json:"tag_ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Verify transaction belongs to user
	var exists bool
	err = database.DB.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM transactions WHERE id = $1 AND user_id = $2)
	`, transactionID, userID).Scan(&exists)
	if err != nil || !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
		return
	}

	// Start transaction
	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error starting transaction"})
		return
	}
	defer tx.Rollback()

	// Delete existing tags
	_, err = tx.Exec(`DELETE FROM transaction_tags WHERE transaction_id = $1`, transactionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating tags"})
		return
	}

	// Insert new tags (only if they belong to the user)
	for _, tagID := range req.TagIDs {
		_, err = tx.Exec(`
			INSERT INTO transaction_tags (transaction_id, tag_id)
			SELECT $1, $2
			WHERE EXISTS (SELECT 1 FROM tags WHERE id = $2 AND user_id = $3)
		`, transactionID, tagID, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error adding tag"})
			return
		}
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error committing changes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tags updated"})
}
