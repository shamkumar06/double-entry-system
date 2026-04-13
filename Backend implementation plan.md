# 1. Project Info & Environment Setup
- **Project Name:** Double Entry system
- **Database Connection:** You MUST connect to the Supabase PostgreSQL database via the Model Context Protocol (MCP) for seamless schema introspection and management.

# 2. Persona & Objective
You are an Elite Backend Engineer, Database Architect, and Financial Systems Security Expert. Your task is to build a robust, scalable, and highly secure RESTful API backend for a Double-Entry Accounting System intended for a small internal team (~25 users). 

**Primary Goal:** Build a highly performant, clean, and secure backend API. The architecture must prioritize speed, relying on optimized queries and a clean Monolithic folder structure. Do not use complex infrastructure like Redis or microservices.

# 3. Technical Stack
- **Runtime/Framework:** Node.js, Express.js, TypeScript (Strict mode)
- **Database & ORM:** PostgreSQL (Hosted on Supabase via MCP - purely as DB) + Prisma ORM
- **Authentication:** Custom JWT in Node.js (Token-based, HTTP-only cookies preferred)
- **File Uploads:** Multer + Supabase Storage SDK
- **External API:** Axios (for Exchange Rate API)

# 4. Authentication & RBAC Rules (Crucial)
1. **Public Registration (`POST /api/auth/register`):** Anyone can register, but new accounts MUST automatically default to the `VIEWER` role.
2. **Admin Management (`POST /api/auth/admin/create`):** Only existing Admins can create new users with the `ADMIN` role or upgrade existing Viewers.
3. **Roles Overview:**
   - **ADMIN:** Full CRUD access across the app. Can create, read, update, and manage all transactions, accounts, projects, and phases.
   - **VIEWER:** Read-only access. Can only view ledgers/dashboards and trigger report generation. Completely restricted from mutating any financial data.

# 5. Core Accounting Rules
1. **Strict Double-Entry Validation:** Every journal entry MUST be wrapped in a Prisma `$transaction`. Backend MUST verify `Sum(Debits) === Sum(Credits)`. Reject immediately if unbalanced.
2. **Precision:** Store all monetary amounts as integers (e.g., paise/cents) or use Prisma `Decimal` to prevent floating-point rounding errors. Do not use floats.
3. **Immutability:** Implement Soft Deletes (`is_deleted: boolean`). Never hard-delete financial records. Reversing entries should be the standard way to correct mistakes.

# 6. Advanced Features & Workflows
1. **Phase-Driven Filtering:** API must support advanced filtering for Journal, Ledger, and Trial Balance endpoints. Endpoints must accept an array of `phaseIds` (e.g., `?phases=1,2`) using Prisma's `in` operator to support "Shift+Click" multi-phase selection from the frontend.
2. **Global Currency Integration:** Integrate with `https://app.exchangerate-api.com/activate/8a9b69f48875f797a58ae63377`. Create a service to fetch real-time conversion rates.
3. **One-Time Setup & Caching:** Currency preferences and Chart of Accounts (Categories) are a one-time setup by the Admin. Create a `SystemSettings` table to persist these choices. Exchange rates should be fetched once and cached temporarily.
4. **Contextual Report Generation:** Create an endpoint to generate Word documents (`docx` or `docxtemplater`) that explicitly respects the phase filters passed from the frontend.

# 7. Required Prisma Schema Entities
Generate the Prisma schema for the following entities, ensuring proper relations:
- `User`: id, email, passwordHash, role (Enum: ADMIN, VIEWER)
- `SystemSettings`: id, baseCurrency, exchangeRateApiKey
- `Project`: id, name, totalFunds, description
- `Phase`: id, projectId, name, estimatedBudget
- `AccountCategory`: id, name, type (Enum: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)
- `Transaction`: id, date, description, phaseId, attachmentUrl (optional), is_deleted
- `TransactionLine`: id, transactionId, accountId, type (Enum: DEBIT, CREDIT), amount

# 8. Output Deliverables Requested
1. Connect to Supabase via MCP and generate the complete `schema.prisma` file incorporating the `SystemSettings` and soft delete structures.
2. Provide the custom JWT Auth logic & RBAC Middleware (handling the default VIEWER registration).
3. Provide the core Service logic for `POST /api/journal` (must include the strict debit=credit validation and Prisma transaction handling).
4. Provide the controller/service logic for fetching Phase-filtered data.
5. Provide the service logic for the Exchange Rate API integration.