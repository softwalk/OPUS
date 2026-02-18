import type { BlueprintType, IndustryType } from "@/types/mvs";

export interface BlueprintDefinition {
  id: BlueprintType;
  name: string;
  category: string;
  description: string;
  entities: string[];
  default_roles: string[];
  default_workflow?: {
    entity: string;
    field: string;
    states: string[];
  };
  compatible_industries: IndustryType[];
  compliance_default?: string[];
}

export interface BlueprintEntityDefault {
  name: string;
  display_name: string;
  fields: Array<{
    name: string;
    type: string;
    display_name: string;
    required?: boolean;
  }>;
  relations?: Array<{
    entity: string;
    type: string;
    display_name: string;
  }>;
}
