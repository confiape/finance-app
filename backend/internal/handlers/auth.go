package handlers

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/warren/finance-app/internal/database"
	"github.com/warren/finance-app/internal/models"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/api/idtoken"
)

var jwtSecret = []byte(getEnv("JWT_SECRET", "your-secret-key-change-in-production"))

type Claims struct {
	UserID int    `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

func Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if user exists
	var exists bool
	err := database.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", req.Email).Scan(&exists)
	if err != nil {
		log.Printf("Register - DB check error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error", "details": err.Error()})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Register - bcrypt error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing password", "details": err.Error()})
		return
	}

	// Insert user
	var user models.User
	err = database.DB.QueryRow(
		`INSERT INTO users (email, password_hash, name)
		 VALUES ($1, $2, $3)
		 RETURNING id, email, name, created_at, updated_at`,
		req.Email, string(hashedPassword), req.Name,
	).Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		log.Printf("Register - Insert user error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating user", "details": err.Error()})
		return
	}

	// Generate token
	token, err := generateToken(user.ID, user.Email)
	if err != nil {
		log.Printf("Register - Token error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error generating token", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, models.AuthResponse{
		Token: token,
		User:  user,
	})
}

func Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	err := database.DB.QueryRow(
		`SELECT id, email, password_hash, name, created_at, updated_at
		 FROM users WHERE email = $1`,
		req.Email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, err := generateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error generating token"})
		return
	}

	c.JSON(http.StatusOK, models.AuthResponse{
		Token: token,
		User:  user,
	})
}

func GetMe(c *gin.Context) {
	userID := c.GetInt("user_id")

	var user models.User
	err := database.DB.QueryRow(
		`SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func generateToken(userID int, email string) (string, error) {
	claims := &Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(72 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// GoogleLoginRequest represents the request body for Google login
type GoogleLoginRequest struct {
	Credential string `json:"credential" binding:"required"`
}

// GoogleLogin handles authentication via Google OAuth
func GoogleLogin(c *gin.Context) {
	var req GoogleLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get Google Client ID from environment
	googleClientID := os.Getenv("GOOGLE_CLIENT_ID")
	if googleClientID == "" {
		log.Printf("GoogleLogin - GOOGLE_CLIENT_ID not configured")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Google authentication not configured"})
		return
	}

	// Verify the Google ID token
	payload, err := idtoken.Validate(context.Background(), req.Credential, googleClientID)
	if err != nil {
		log.Printf("GoogleLogin - Token validation error: %v", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Google token"})
		return
	}

	// Extract user info from token
	email, _ := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)
	googleID, _ := payload.Claims["sub"].(string)

	if email == "" || googleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid token claims"})
		return
	}

	// Check if user exists by google_id or email
	var user models.User
	var passwordHash sql.NullString
	err = database.DB.QueryRow(
		`SELECT id, email, password_hash, name, created_at, updated_at
		 FROM users WHERE google_id = $1 OR email = $2`,
		googleID, email,
	).Scan(&user.ID, &user.Email, &passwordHash, &user.Name, &user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		// User doesn't exist, create new user
		err = database.DB.QueryRow(
			`INSERT INTO users (email, name, google_id)
			 VALUES ($1, $2, $3)
			 RETURNING id, email, name, created_at, updated_at`,
			email, name, googleID,
		).Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt, &user.UpdatedAt)

		if err != nil {
			log.Printf("GoogleLogin - Create user error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating user", "details": err.Error()})
			return
		}
	} else if err != nil {
		log.Printf("GoogleLogin - DB error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error", "details": err.Error()})
		return
	} else {
		// User exists, update google_id if not set
		_, err = database.DB.Exec(
			`UPDATE users SET google_id = $1 WHERE id = $2 AND google_id IS NULL`,
			googleID, user.ID,
		)
		if err != nil {
			log.Printf("GoogleLogin - Update google_id error: %v", err)
		}
	}

	// Generate JWT token
	token, err := generateToken(user.ID, user.Email)
	if err != nil {
		log.Printf("GoogleLogin - Token generation error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error generating token"})
		return
	}

	c.JSON(http.StatusOK, models.AuthResponse{
		Token: token,
		User:  user,
	})
}
