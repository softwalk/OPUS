import { callAgentJSON } from "./client";
import type { MVS } from "@/types/mvs";
import type { PRD } from "@/types/prd";
import { readFileSync } from "fs";
import { join } from "path";

function getMasterPrompt(): string {
  try {
    const promptPath = join(process.cwd(), "..", "prompts", "v1", "system-architect.md");
    return readFileSync(promptPath, "utf-8");
  } catch {
    return getDefaultArchitectPrompt();
  }
}

function getDefaultArchitectPrompt(): string {
  return `<role>
You are the principal architect of SaaS Factory. Transform a Minimum Viable Spec (MVS) into a comprehensive Product Requirements Document (PRD) that an automated pipeline can convert into working code.
</role>

<context>
Tech stack:
- Frontend: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Next.js API Routes + Prisma ORM
- Database: PostgreSQL with Row Level Security (RLS)
- Auth: NextAuth.js (email + OAuth)
- Billing: Stripe
- Deploy: Docker containers
- Multi-tenancy: Shared schema with RLS (tenant_id on every business table)
</context>

<task>
Generate a complete PRD with these exact sections:

1. DATABASE_SCHEMA: Complete Prisma schema including all MVS entities, tenant/user tables, audit_log, soft delete, timestamps, relations, indexes
2. API_ROUTES: For each entity - GET list (paginated), GET detail, POST create, PATCH update, DELETE soft-delete, with auth middleware and Zod validation
3. PERMISSIONS_MATRIX: What each role can do on each entity (CRUD)
4. UI_PAGES: For each entity - list page, detail page, create/edit form
5. WORKFLOWS: State machines if applicable
6. BILLING_CONFIG: If billing_enabled
7. SEED_DATA: 5+ realistic records per entity
</task>

<constraints>
- Never invent entities not in the MVS
- Always include tenant_id on business tables
- Always include soft delete and timestamps
- Always include audit_log for write operations
- Table/field names in English, display_name in the MVS locale
- Correct Prisma types
- Zod validation for all API input
- Cursor-based pagination on all lists
- Rate limiting: 100 req/min read, 30 req/min write
</constraints>

<output_format>
Respond EXCLUSIVELY with valid JSON. No markdown, no explanations.
</output_format>`;
}

export async function generatePRD(mvs: MVS): Promise<PRD> {
  const systemPrompt = getMasterPrompt();
  const userMessage = `Generate the complete PRD for the following MVS:\n\n${JSON.stringify(mvs, null, 2)}`;

  return callAgentJSON<PRD>("architecture", systemPrompt, userMessage);
}

export async function generateDesign(prd: PRD): Promise<{
  fileStructure: string[];
  prismaSchema: string;
  apiRoutes: Array<{ path: string; methods: string[] }>;
  components: string[];
  middleware: string[];
}> {
  const systemPrompt = `You are the Design Agent for SaaS Factory. Given a PRD, produce a detailed Design Document that specifies the exact file structure, Prisma schema, and component list for code generation.

Respond EXCLUSIVELY with valid JSON.`;

  const userMessage = `Generate the Design Document for:\n\n${JSON.stringify(prd, null, 2)}`;

  return callAgentJSON("architecture", systemPrompt, userMessage);
}
