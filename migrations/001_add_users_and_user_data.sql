CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    auth0Id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    displayName VARCHAR(255),
    locale VARCHAR(10),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS userData (
    userId INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    shoppingList JSONB NOT NULL DEFAULT '[]'::jsonb,
    favourites JSONB NOT NULL DEFAULT '[]'::jsonb,
    filters JSONB NOT NULL DEFAULT '[{"filterName":"-100% to -50%","fromPercentage":-100,"toPercentage":-50},{"filterName":"-50% to -25%","fromPercentage":-50,"toPercentage":-25},{"filterName":"-25% to 0%","fromPercentage":-25,"toPercentage":0}]'::jsonb,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
