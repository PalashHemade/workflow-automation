import { defineConfig } from "prisma/config";

// Load .env for local CLI usage (prisma.config.ts opts out of Prisma's old
// built-in .env auto-loading). In Docker/production, real environment
// variables are already set by the runtime, so a missing `dotenv` package
// there is fine — swallow it instead of crashing `prisma migrate deploy`.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv").config();
} catch {
  // dotenv not installed — assume env vars are already set (e.g. in Docker)
}

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
});
