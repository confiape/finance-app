-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    color VARCHAR(7) DEFAULT '#6366f1',
    icon VARCHAR(50) DEFAULT 'category',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    date DATE NOT NULL,
    source VARCHAR(50) DEFAULT 'manual',
    raw_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Imports table (track uploaded files)
CREATE TABLE IF NOT EXISTS imports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('excel', 'image')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_transactions INTEGER DEFAULT 0,
    processed_transactions INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_categories_user_id ON categories(user_id);

-- Insert default categories (will be copied for each new user via trigger)
INSERT INTO categories (user_id, name, type, color, icon, is_default) VALUES
    (NULL, 'Salario', 'income', '#22c55e', 'payments', TRUE),
    (NULL, 'Freelance', 'income', '#10b981', 'work', TRUE),
    (NULL, 'Inversiones', 'income', '#06b6d4', 'trending_up', TRUE),
    (NULL, 'Otros ingresos', 'income', '#8b5cf6', 'add_circle', TRUE),
    (NULL, 'Alimentación', 'expense', '#ef4444', 'restaurant', TRUE),
    (NULL, 'Transporte', 'expense', '#f97316', 'directions_car', TRUE),
    (NULL, 'Entretenimiento', 'expense', '#ec4899', 'movie', TRUE),
    (NULL, 'Servicios', 'expense', '#6366f1', 'receipt', TRUE),
    (NULL, 'Salud', 'expense', '#14b8a6', 'medical_services', TRUE),
    (NULL, 'Educación', 'expense', '#3b82f6', 'school', TRUE),
    (NULL, 'Compras', 'expense', '#f59e0b', 'shopping_cart', TRUE),
    (NULL, 'Otros gastos', 'expense', '#64748b', 'more_horiz', TRUE);

-- Function to copy default categories for new users
CREATE OR REPLACE FUNCTION copy_default_categories()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO categories (user_id, name, type, color, icon, is_default)
    SELECT NEW.id, name, type, color, icon, FALSE
    FROM categories
    WHERE user_id IS NULL AND is_default = TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create categories for new users
CREATE TRIGGER trigger_copy_categories
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION copy_default_categories();
