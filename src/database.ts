import { Sequelize } from "sequelize";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

// Enable SQL logging in development for debugging table name issues
const isDevelopment = process.env.NODE_ENV !== "production";

export const sequelize = new Sequelize(process.env.PG_HOST, {
  logging: isDevelopment
    ? (msg) => {
        // Log only if it contains table references for debugging
        if (
          msg.toLowerCase().includes("from ") ||
          msg.toLowerCase().includes("into ") ||
          msg.toLowerCase().includes("update ")
        ) {
          console.log("SQL:", msg);
        }
      }
    : false,
  pool: {
    max: 5,
    min: 2,
    acquire: 60000,
    idle: 30000,
    evict: 60000,
  },
  retry: {
    max: MAX_RETRIES,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
    ],
  },
  dialectOptions: {
    statement_timeout: 300000, // 5 minutes in milliseconds
    idle_in_transaction_session_timeout: 180000, // 3 minutes
  },
});

/**
 * Authenticate with retry logic for resilient database connections
 */
export async function authenticateWithRetry(): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sequelize.authenticate();
      console.log("Database connection established successfully.");
      return;
    } catch (error) {
      lastError = error as Error;
      console.error(
        `Database connection attempt ${attempt}/${MAX_RETRIES} failed:`,
        (error as Error).message,
      );

      if (attempt < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw new Error(
    `Failed to connect to database after ${MAX_RETRIES} attempts. Last error: ${lastError?.message}`,
  );
}
