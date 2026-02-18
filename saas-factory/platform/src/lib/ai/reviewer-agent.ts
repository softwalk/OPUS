import { callAgentJSON } from "./client";
import type { PRD } from "@/types/prd";
import type { GeneratedFile } from "@/types/generation";

interface ReviewResult {
  passed: boolean;
  score: number;
  issues: Array<{
    severity: "error" | "warning" | "info";
    file: string;
    message: string;
    suggestion?: string;
  }>;
  summary: string;
}

const REVIEWER_SYSTEM_PROMPT = `You are the Code Reviewer Agent for SaaS Factory. Review generated code against the PRD and security requirements.

Check for:
1. PRD Compliance: Are all entities, routes, and permissions implemented?
2. Security: No eval(), no dangerouslySetInnerHTML, parameterized queries only, tenant_id on all queries
3. Type Safety: Proper TypeScript types, Zod validation on inputs
4. Best Practices: Error handling, proper async/await, no memory leaks
5. Completeness: All CRUD operations, all UI pages, all roles

Score from 0-100. Pass threshold is 80.

Respond with JSON only:
{
  "passed": boolean,
  "score": number,
  "issues": [
    {
      "severity": "error|warning|info",
      "file": "path/to/file",
      "message": "description of issue",
      "suggestion": "how to fix"
    }
  ],
  "summary": "brief overall assessment"
}`;

export async function reviewCode(
  prd: PRD,
  files: GeneratedFile[]
): Promise<ReviewResult> {
  const filesSummary = files
    .map((f) => `=== ${f.path} ===\n${f.content}`)
    .join("\n\n");

  const userMessage = `Review this generated code against the PRD.

PRD App: ${prd.app_name}
Expected entities: ${prd.api_routes.map((r) => r.path).join(", ")}
Expected roles: ${Object.keys(prd.permissions_matrix).join(", ")}
Expected pages: ${prd.ui_pages.map((p) => p.path).join(", ")}

Generated files (${files.length} total):
${filesSummary}`;

  return callAgentJSON<ReviewResult>("review", REVIEWER_SYSTEM_PROMPT, userMessage);
}
