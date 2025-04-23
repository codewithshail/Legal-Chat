import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: ("postgresql://neondb_owner:npg_n4jMPEkX9fOp@ep-black-pine-a42ksyqz-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require")  // Assuming DATABASE_URL is correctly set in your environment variables
  }
});