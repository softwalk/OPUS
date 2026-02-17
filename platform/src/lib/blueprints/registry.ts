import type { BlueprintDefinition, BlueprintEntityDefault } from "./types";
import type { BlueprintType, MvsEntity } from "@/types/mvs";

const BLUEPRINTS: BlueprintDefinition[] = [
  {
    id: "crm",
    name: "CRM (Customer Relationship Management)",
    category: "sales",
    description: "Gestión de contactos, empresas y pipeline de ventas",
    entities: ["Contact", "Company", "Deal", "Pipeline", "Activity"],
    default_roles: ["admin", "sales_rep", "manager"],
    default_workflow: {
      entity: "Deal",
      field: "status",
      states: ["lead", "qualified", "proposal", "negotiation", "won", "lost"],
    },
    compatible_industries: ["general", "retail", "real_estate", "finance", "manufacturing"],
  },
  {
    id: "inventory",
    name: "Gestión de Inventario",
    category: "operations",
    description: "Control de stock, productos, almacenes y proveedores",
    entities: ["Product", "Category", "Warehouse", "StockMovement", "Supplier", "PurchaseOrder"],
    default_roles: ["admin", "warehouse_manager", "viewer"],
    default_workflow: {
      entity: "PurchaseOrder",
      field: "status",
      states: ["draft", "submitted", "approved", "received", "cancelled"],
    },
    compatible_industries: ["retail", "manufacturing", "logistics", "hospitality"],
  },
  {
    id: "booking",
    name: "Sistema de Reservas",
    category: "scheduling",
    description: "Agendamiento de citas, servicios y recursos",
    entities: ["Service", "Resource", "Booking", "Client", "TimeSlot"],
    default_roles: ["admin", "provider", "client"],
    default_workflow: {
      entity: "Booking",
      field: "status",
      states: ["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"],
    },
    compatible_industries: ["healthcare", "hospitality", "education", "general"],
  },
  {
    id: "lms",
    name: "Learning Management System",
    category: "education",
    description: "Plataforma de cursos, lecciones y seguimiento de progreso",
    entities: ["Course", "Module", "Lesson", "Student", "Enrollment", "Progress", "Certificate"],
    default_roles: ["admin", "instructor", "student"],
    default_workflow: {
      entity: "Course",
      field: "status",
      states: ["draft", "review", "published", "archived"],
    },
    compatible_industries: ["education", "general"],
  },
  {
    id: "invoicing",
    name: "Facturación y Cobranza",
    category: "finance",
    description: "Emisión de facturas, control de pagos y reportes fiscales",
    entities: ["Invoice", "LineItem", "Client", "Payment", "TaxConfig"],
    default_roles: ["admin", "accountant", "viewer"],
    default_workflow: {
      entity: "Invoice",
      field: "status",
      states: ["draft", "sent", "viewed", "paid", "overdue", "cancelled"],
    },
    compatible_industries: ["general", "finance", "legal", "manufacturing"],
  },
  {
    id: "tickets",
    name: "Mesa de Ayuda / Soporte",
    category: "support",
    description: "Tickets de soporte, agentes, colas y SLAs",
    entities: ["Ticket", "Agent", "Queue", "Response", "Tag", "SLA"],
    default_roles: ["admin", "agent", "customer"],
    default_workflow: {
      entity: "Ticket",
      field: "status",
      states: ["open", "assigned", "in_progress", "waiting_customer", "resolved", "closed"],
    },
    compatible_industries: ["general", "retail", "finance", "manufacturing"],
  },
  {
    id: "projects",
    name: "Gestión de Proyectos",
    category: "productivity",
    description: "Proyectos, tareas, sprints y colaboración",
    entities: ["Project", "Task", "Sprint", "Team", "Comment", "Milestone"],
    default_roles: ["admin", "project_manager", "member", "viewer"],
    default_workflow: {
      entity: "Task",
      field: "status",
      states: ["backlog", "todo", "in_progress", "review", "done"],
    },
    compatible_industries: ["general", "manufacturing", "education"],
  },
  {
    id: "ehr",
    name: "Expediente Clínico Electrónico",
    category: "healthcare",
    description: "Pacientes, consultas, recetas y expedientes médicos",
    entities: ["Patient", "Encounter", "Prescription", "Vital", "LabResult", "Appointment"],
    default_roles: ["admin", "doctor", "nurse", "receptionist"],
    default_workflow: {
      entity: "Appointment",
      field: "status",
      states: ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"],
    },
    compatible_industries: ["healthcare"],
    compliance_default: ["lfpdppp"],
  },
  {
    id: "marketplace",
    name: "Marketplace",
    category: "commerce",
    description: "Plataforma de compra-venta entre usuarios",
    entities: ["Listing", "Order", "Review", "Seller", "Category", "Transaction"],
    default_roles: ["admin", "seller", "buyer"],
    default_workflow: {
      entity: "Order",
      field: "status",
      states: ["pending", "paid", "shipped", "delivered", "returned", "cancelled"],
    },
    compatible_industries: ["retail", "general"],
  },
  {
    id: "pms",
    name: "Property Management",
    category: "real_estate",
    description: "Gestión de propiedades, unidades, reservas y mantenimiento",
    entities: ["Property", "Unit", "Reservation", "Guest", "MaintenanceRequest", "Payment"],
    default_roles: ["admin", "property_manager", "maintenance", "guest"],
    default_workflow: {
      entity: "Reservation",
      field: "status",
      states: ["pending", "confirmed", "checked_in", "checked_out", "cancelled"],
    },
    compatible_industries: ["real_estate", "hospitality"],
  },
  {
    id: "custom",
    name: "Custom (Personalizado)",
    category: "general",
    description: "Blueprint vacío para apps que no encajan en ninguna categoría",
    entities: [],
    default_roles: ["admin", "member", "viewer"],
    compatible_industries: ["general"],
  },
];

// Default entity fields per blueprint
const ENTITY_DEFAULTS: Record<string, BlueprintEntityDefault> = {
  Contact: {
    name: "Contact",
    display_name: "Contacto",
    fields: [
      { name: "full_name", type: "string", display_name: "Nombre completo", required: true },
      { name: "email", type: "email", display_name: "Email" },
      { name: "phone", type: "phone", display_name: "Teléfono" },
      { name: "position", type: "string", display_name: "Cargo" },
      { name: "notes", type: "text", display_name: "Notas" },
    ],
    relations: [{ entity: "Company", type: "many_to_one", display_name: "Empresa" }],
  },
  Company: {
    name: "Company",
    display_name: "Empresa",
    fields: [
      { name: "name", type: "string", display_name: "Nombre", required: true },
      { name: "industry", type: "string", display_name: "Industria" },
      { name: "website", type: "url", display_name: "Sitio web" },
      { name: "size", type: "enum", display_name: "Tamaño" },
      { name: "address", type: "text", display_name: "Dirección" },
    ],
  },
  Deal: {
    name: "Deal",
    display_name: "Negocio",
    fields: [
      { name: "title", type: "string", display_name: "Título", required: true },
      { name: "value", type: "money", display_name: "Valor" },
      { name: "status", type: "enum", display_name: "Estado", required: true },
      { name: "expected_close_date", type: "date", display_name: "Fecha estimada de cierre" },
      { name: "notes", type: "text", display_name: "Notas" },
    ],
    relations: [
      { entity: "Contact", type: "many_to_one", display_name: "Contacto" },
      { entity: "Company", type: "many_to_one", display_name: "Empresa" },
    ],
  },
  Pipeline: {
    name: "Pipeline",
    display_name: "Pipeline",
    fields: [
      { name: "name", type: "string", display_name: "Nombre", required: true },
      { name: "stages", type: "json", display_name: "Etapas" },
      { name: "is_default", type: "boolean", display_name: "Es default" },
    ],
  },
  Activity: {
    name: "Activity",
    display_name: "Actividad",
    fields: [
      { name: "type", type: "enum", display_name: "Tipo", required: true },
      { name: "subject", type: "string", display_name: "Asunto", required: true },
      { name: "description", type: "text", display_name: "Descripción" },
      { name: "scheduled_at", type: "datetime", display_name: "Fecha programada" },
      { name: "completed", type: "boolean", display_name: "Completada" },
    ],
    relations: [
      { entity: "Contact", type: "many_to_one", display_name: "Contacto" },
      { entity: "Deal", type: "many_to_one", display_name: "Negocio" },
    ],
  },
};

export function getBlueprints(): BlueprintDefinition[] {
  return BLUEPRINTS;
}

export function getBlueprintById(id: BlueprintType): BlueprintDefinition | undefined {
  return BLUEPRINTS.find((b) => b.id === id);
}

export function getBlueprintEntityDefaults(entityName: string): BlueprintEntityDefault | undefined {
  return ENTITY_DEFAULTS[entityName];
}

export function getBlueprintEntitiesWithDefaults(blueprintId: BlueprintType): MvsEntity[] {
  const blueprint = getBlueprintById(blueprintId);
  if (!blueprint) return [];

  return blueprint.entities
    .map((entityName) => {
      const defaults = ENTITY_DEFAULTS[entityName];
      if (!defaults) {
        return {
          name: entityName,
          display_name: entityName,
          fields: [{ name: "name", type: "string" as const, display_name: "Nombre", required: true }],
        };
      }
      return {
        name: defaults.name,
        display_name: defaults.display_name,
        fields: defaults.fields.map((f) => ({
          name: f.name,
          type: f.type as MvsEntity["fields"][0]["type"],
          display_name: f.display_name,
          required: f.required,
        })),
        relations: defaults.relations?.map((r) => ({
          entity: r.entity,
          type: r.type as MvsEntity["relations"] extends (infer U)[] | undefined ? U extends { type: infer T } ? T : never : never,
          display_name: r.display_name,
        })),
      };
    })
    .filter(Boolean) as MvsEntity[];
}
