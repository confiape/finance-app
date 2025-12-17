-- Add parent_id column for subcategories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE;

-- Create index for parent_id
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

-- Insert default subcategories for existing users
-- We'll add subcategories for "Servicios" category
DO $$
DECLARE
    servicios_cat RECORD;
BEGIN
    -- For each user's "Servicios" category, create subcategories
    FOR servicios_cat IN
        SELECT id, user_id FROM categories
        WHERE name = 'Servicios' AND type = 'expense' AND parent_id IS NULL
    LOOP
        -- Insert subcategories if they don't exist
        INSERT INTO categories (user_id, name, type, color, icon, is_default, parent_id)
        SELECT servicios_cat.user_id, sub.name, 'expense', sub.color, sub.icon, FALSE, servicios_cat.id
        FROM (VALUES
            ('Agua', '#0ea5e9', 'water_drop'),
            ('Luz', '#eab308', 'bolt'),
            ('Internet', '#8b5cf6', 'wifi'),
            ('Gas', '#f97316', 'local_fire_department'),
            ('Teléfono', '#22c55e', 'phone')
        ) AS sub(name, color, icon)
        WHERE NOT EXISTS (
            SELECT 1 FROM categories
            WHERE parent_id = servicios_cat.id AND name = sub.name
        );
    END LOOP;
END $$;

-- Update the trigger function to also copy subcategories for new users
CREATE OR REPLACE FUNCTION copy_default_categories()
RETURNS TRIGGER AS $$
DECLARE
    old_cat_id INTEGER;
    new_cat_id INTEGER;
BEGIN
    -- First, copy parent categories
    FOR old_cat_id, new_cat_id IN
        INSERT INTO categories (user_id, name, type, color, icon, is_default, parent_id)
        SELECT NEW.id, name, type, color, icon, FALSE, NULL
        FROM categories
        WHERE user_id IS NULL AND is_default = TRUE AND parent_id IS NULL
        RETURNING id, id
    LOOP
        -- This loop doesn't do anything, we just need the INSERT to execute
    END LOOP;

    -- Then copy subcategories, mapping parent_ids
    INSERT INTO categories (user_id, name, type, color, icon, is_default, parent_id)
    SELECT
        NEW.id,
        c.name,
        c.type,
        c.color,
        c.icon,
        FALSE,
        (SELECT id FROM categories WHERE user_id = NEW.id AND name = p.name AND parent_id IS NULL)
    FROM categories c
    JOIN categories p ON c.parent_id = p.id
    WHERE c.user_id IS NULL AND c.is_default = TRUE AND c.parent_id IS NOT NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add default subcategories to the template (user_id = NULL)
DO $$
DECLARE
    servicios_id INTEGER;
BEGIN
    -- Get the default Servicios category (user_id IS NULL)
    SELECT id INTO servicios_id FROM categories
    WHERE name = 'Servicios' AND type = 'expense' AND user_id IS NULL AND parent_id IS NULL
    LIMIT 1;

    IF servicios_id IS NOT NULL THEN
        INSERT INTO categories (user_id, name, type, color, icon, is_default, parent_id)
        SELECT NULL, sub.name, 'expense', sub.color, sub.icon, TRUE, servicios_id
        FROM (VALUES
            ('Agua', '#0ea5e9', 'water_drop'),
            ('Luz', '#eab308', 'bolt'),
            ('Internet', '#8b5cf6', 'wifi'),
            ('Gas', '#f97316', 'local_fire_department'),
            ('Teléfono', '#22c55e', 'phone')
        ) AS sub(name, color, icon)
        WHERE NOT EXISTS (
            SELECT 1 FROM categories
            WHERE parent_id = servicios_id AND name = sub.name AND user_id IS NULL
        );
    END IF;
END $$;
