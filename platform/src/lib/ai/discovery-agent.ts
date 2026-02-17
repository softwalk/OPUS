import { callAgentJSON } from "./client";
import type { DiscoveryClassification } from "@/types/mvs";

const DISCOVERY_SYSTEM_PROMPT = `You are the Discovery Agent for SaaS Factory, a platform that generates complete SaaS applications.

Your job is to classify user intent from a free-form description and map it to a blueprint type and industry.

Available blueprints:
- crm: Contact/company/deal management, sales pipeline
- inventory: Stock/product/warehouse management
- booking: Appointment/reservation scheduling
- lms: Course/lesson management, student tracking
- invoicing: Invoice/payment/billing management
- tickets: Support tickets, helpdesk, SLA management
- projects: Project/task/sprint management
- ehr: Electronic health records, patient management
- marketplace: Buy/sell platform, listings, orders
- pms: Property management, reservations, maintenance
- custom: Doesn't fit any category

Available industries:
healthcare, retail, education, real_estate, hospitality, finance, logistics, legal, manufacturing, general

Respond ONLY with valid JSON, no explanations.`;

export async function classifyIntent(description: string): Promise<DiscoveryClassification> {
  const userMessage = `Analyze this description and classify it:

"${description}"

Respond with JSON:
{
  "intent": "brief summary of what they want",
  "industry": "industry enum value",
  "sub_industry": "optional specific niche",
  "detected_entities": ["list", "of", "entities", "mentioned"],
  "detected_features": ["list", "of", "features", "mentioned"],
  "confidence": 0.0-1.0,
  "suggested_blueprint": "blueprint enum value",
  "suggested_overlay": "industry overlay if applicable"
}`;

  return callAgentJSON<DiscoveryClassification>("classification", DISCOVERY_SYSTEM_PROMPT, userMessage);
}
