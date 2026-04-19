import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    provider: "postgresql",
    url: process.env.DATABASE_URL as string,
  },
  migrations: {
    path: "prisma/migrations",
  },
  seed: {
    command: "ts-node -O \"{\\\"rootDir\\\":\\\".\\\"}\" prisma/seed.ts",
  },
});
