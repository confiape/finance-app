-- Tags system to replace categories
-- Tags are flat (no hierarchy) and transactions can have multiple tags

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create transaction_tags pivot table (many-to-many)
CREATE TABLE IF NOT EXISTS transaction_tags (
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, tag_id)
);

-- Migrate existing categories to tags
INSERT INTO tags (user_id, name, color, created_at)
SELECT user_id, name, color, created_at
FROM categories
WHERE parent_id IS NULL
ON CONFLICT DO NOTHING;

-- Also migrate subcategories as separate tags
INSERT INTO tags (user_id, name, color, created_at)
SELECT user_id, name, color, created_at
FROM categories
WHERE parent_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Migrate existing transaction-category relationships to transaction_tags
INSERT INTO transaction_tags (transaction_id, tag_id)
SELECT t.id, tg.id
FROM transactions t
JOIN categories c ON t.category_id = c.id
JOIN tags tg ON tg.name = c.name AND tg.user_id = c.user_id
ON CONFLICT DO NOTHING;

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_transaction_id ON transaction_tags(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag_id ON transaction_tags(tag_id);

-- Unique constraint: user can't have duplicate tag names
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_user_name ON tags(user_id, name);
