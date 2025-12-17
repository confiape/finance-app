package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/warren/finance-app/internal/database"
	"github.com/warren/finance-app/internal/handlers"
	"github.com/warren/finance-app/internal/middleware"
)

func main() {
	// Connect to database
	if err := database.Connect(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Setup router
	r := gin.Default()

	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Public routes
	r.POST("/api/auth/register", handlers.Register)
	r.POST("/api/auth/login", handlers.Login)

	// Protected routes
	api := r.Group("/api")
	api.Use(middleware.AuthMiddleware())
	{
		// User
		api.GET("/auth/me", handlers.GetMe)

		// Categories
		api.GET("/categories", handlers.GetCategories)
		api.POST("/categories", handlers.CreateCategory)
		api.PUT("/categories/:id", handlers.UpdateCategory)
		api.DELETE("/categories/:id", handlers.DeleteCategory)

		// Accounts
		api.GET("/accounts", handlers.GetAccounts)
		api.POST("/accounts", handlers.CreateAccount)
		api.GET("/accounts/:id", handlers.GetAccount)
		api.PUT("/accounts/:id", handlers.UpdateAccount)
		api.DELETE("/accounts/:id", handlers.DeleteAccount)
		api.GET("/accounts/:id/balance", handlers.GetAccountBalance)

		// Transactions
		api.GET("/transactions", handlers.GetTransactions)
		api.POST("/transactions", handlers.CreateTransaction)
		api.PUT("/transactions/:id", handlers.UpdateTransaction)
		api.DELETE("/transactions/:id", handlers.DeleteTransaction)
		api.DELETE("/transactions", handlers.DeleteTransactionsBatch)
		api.PATCH("/transactions/:id/category", handlers.UpdateTransactionCategory)

		// Dashboard
		api.GET("/dashboard", handlers.GetDashboard)

		// Import
		api.GET("/banks", handlers.GetBanks)
		api.POST("/import/upload", handlers.UploadFile)
		api.POST("/import/confirm", handlers.ConfirmImport)
		api.GET("/imports", handlers.GetImports)
	}

	// Get port from environment or default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
