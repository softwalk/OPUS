import { callAgentJSON } from "./client";
import type { PRD } from "@/types/prd";
import type { GeneratedFile } from "@/types/generation";

const CODEGEN_SYSTEM_PROMPT = `You are the Code Generation Agent for SaaS Factory. Given a PRD and design document, generate production-ready TypeScript/Next.js code.

Tech stack:
- Next.js 15 (App Router) + TypeScript strict mode
- Tailwind CSS + shadcn/ui components
- Prisma ORM for database
- Zod for validation
- NextAuth.js for auth
- Multi-tenant with tenant_id on all business tables

Rules:
1. Generate clean, type-safe TypeScript code
2. Use Prisma for all database queries (no raw SQL)
3. Include Zod validation schemas for all API inputs
4. Use shadcn/ui components for UI
5. Implement proper error handling
6. Include tenant_id filtering in all queries
7. Follow Next.js App Router conventions
8. Use Server Components where possible, Client Components only when needed

Output format - respond with JSON:
{
  "files": [
    { "path": "relative/path/to/file.ts", "content": "file content here" }
  ],
  "module": "module_name"
}`;

export type CodeGenModule = "database" | "api" | "frontend" | "auth" | "billing" | "config" | "seed";

export async function generateModuleCode(
  prd: PRD,
  module: CodeGenModule,
  existingFiles?: GeneratedFile[]
): Promise<GeneratedFile[]> {
  const moduleInstructions = getModuleInstructions(module, prd);

  const userMessage = `Generate the "${module}" module code for this app:

App: ${prd.app_name}

PRD Summary:
- Entities: ${prd.api_routes.map((r) => r.path).join(", ")}
- Roles: ${Object.keys(prd.permissions_matrix).join(", ")}
- Pages: ${prd.ui_pages.map((p) => p.path).join(", ")}

${moduleInstructions}

${existingFiles ? `\nExisting files for context:\n${existingFiles.map((f) => `// ${f.path}\n${f.content.substring(0, 200)}...`).join("\n\n")}` : ""}

Full PRD:
${JSON.stringify(prd, null, 2)}`;

  const result = await callAgentJSON<{ files: GeneratedFile[]; module: string }>(
    "codegen",
    CODEGEN_SYSTEM_PROMPT,
    userMessage
  );

  return result.files;
}

function getModuleInstructions(module: CodeGenModule, prd: PRD): string {
  switch (module) {
    case "database":
      return `Generate:
1. prisma/schema.prisma - Complete Prisma schema from the PRD
2. prisma/seed.ts - Seed script with realistic data

Use the database_schema from the PRD. Include all models, relations, enums, and indexes.`;

    case "api":
      return `Generate API route files for each entity. For each entity create:
- src/app/api/v1/{entity}/route.ts (GET list, POST create)
- src/app/api/v1/{entity}/[id]/route.ts (GET detail, PATCH update, DELETE)

Include: auth middleware check, tenant_id filtering, Zod validation, error handling, pagination.`;

    case "frontend":
      return `Generate frontend pages for each entity:
- src/app/(dashboard)/{entity}/page.tsx (list view with table)
- src/app/(dashboard)/{entity}/[id]/page.tsx (detail view)
- src/app/(dashboard)/{entity}/new/page.tsx (create form)
- src/components/forms/{Entity}Form.tsx (reusable form component)

Use shadcn/ui components (Table, Card, Button, Input, Label, Select).
Use Server Components for data fetching, Client Components for forms.`;

    case "auth":
      return `Generate auth configuration:
- src/lib/auth.ts - NextAuth config
- src/lib/permissions.ts - RBAC system based on the permissions_matrix
- src/middleware.ts - Auth + tenant resolution middleware`;

    case "billing":
      return `Generate billing integration if billing_enabled:
- src/lib/billing.ts - Stripe helpers
Only generate if billing is configured in the PRD.`;

    case "config":
      return `Generate configuration files:
- package.json (dependencies)
- next.config.ts
- .env.example
- Dockerfile (multi-stage build)
- docker-compose.yaml (app + postgres + redis)
- tsconfig.json`;

    case "seed":
      return `Generate seed data script:
- prisma/seed.ts with realistic data from the PRD seed_data section
Include admin user, sample tenants, and business data.`;

    default:
      return "";
  }
}

export async function generateAllCode(prd: PRD): Promise<GeneratedFile[]> {
  const allFiles: GeneratedFile[] = [];

  // Parallel modules
  const parallelModules: CodeGenModule[] = ["database", "api", "frontend", "auth"];
  const parallelResults = await Promise.all(
    parallelModules.map((module) => generateModuleCode(prd, module))
  );
  for (const files of parallelResults) {
    allFiles.push(...files);
  }

  // Sequential modules
  const sequentialModules: CodeGenModule[] = ["config", "seed"];
  for (const module of sequentialModules) {
    const files = await generateModuleCode(prd, module, allFiles);
    allFiles.push(...files);
  }

  return allFiles;
}
