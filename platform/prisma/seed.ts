import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "postgresql://localhost:5432/saasfactory",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // ── Blueprints ──
  const blueprints = [
    { id: "crm", name: "CRM (Customer Relationship Management)", category: "sales", description: "Gestion de contactos, empresas y pipeline de ventas", entities: ["Contact", "Company", "Deal", "Pipeline", "Activity"], isPremium: false },
    { id: "inventory", name: "Gestion de Inventario", category: "operations", description: "Control de stock, productos, almacenes y proveedores", entities: ["Product", "Category", "Warehouse", "StockMovement", "Supplier", "PurchaseOrder"], isPremium: false },
    { id: "booking", name: "Sistema de Reservas", category: "scheduling", description: "Agendamiento de citas, servicios y recursos", entities: ["Service", "Resource", "Booking", "Client", "TimeSlot"], isPremium: false },
    { id: "lms", name: "Learning Management System", category: "education", description: "Plataforma de cursos, lecciones y seguimiento de progreso", entities: ["Course", "Module", "Lesson", "Student", "Enrollment", "Progress", "Certificate"], isPremium: false },
    { id: "invoicing", name: "Facturacion y Cobranza", category: "finance", description: "Emision de facturas, control de pagos y reportes fiscales", entities: ["Invoice", "LineItem", "Client", "Payment", "TaxConfig"], isPremium: false },
    { id: "tickets", name: "Mesa de Ayuda / Soporte", category: "support", description: "Tickets de soporte, agentes, colas y SLAs", entities: ["Ticket", "Agent", "Queue", "Response", "Tag", "SLA"], isPremium: false },
    { id: "projects", name: "Gestion de Proyectos", category: "productivity", description: "Proyectos, tareas, sprints y colaboracion", entities: ["Project", "Task", "Sprint", "Team", "Comment", "Milestone"], isPremium: false },
    { id: "ehr", name: "Expediente Clinico Electronico", category: "healthcare", description: "Pacientes, consultas, recetas y expedientes medicos", entities: ["Patient", "Encounter", "Prescription", "Vital", "LabResult", "Appointment"], isPremium: true },
    { id: "marketplace", name: "Marketplace", category: "commerce", description: "Plataforma de compra-venta entre usuarios", entities: ["Listing", "Order", "Review", "Seller", "Category", "Transaction"], isPremium: false },
    { id: "pms", name: "Property Management", category: "real_estate", description: "Gestion de propiedades, unidades, reservas y mantenimiento", entities: ["Property", "Unit", "Reservation", "Guest", "MaintenanceRequest", "Payment"], isPremium: true },
    { id: "custom", name: "Custom (Personalizado)", category: "general", description: "Blueprint vacio para apps personalizadas", entities: [], isPremium: false },
  ];

  for (const bp of blueprints) {
    await prisma.blueprint.upsert({
      where: { id: bp.id },
      update: { name: bp.name, description: bp.description, category: bp.category, entities: bp.entities, isPremium: bp.isPremium },
      create: { id: bp.id, name: bp.name, description: bp.description, category: bp.category, entities: bp.entities, isPremium: bp.isPremium },
    });
  }
  console.log(`  ${blueprints.length} blueprints seeded`);

  // ── Industry Overlays ──
  const overlays = [
    {
      id: "healthcare",
      name: "Salud / Healthcare",
      description: "Overlay para aplicaciones del sector salud",
      entityModifications: {
        Patient: { extraFields: ["blood_type", "allergies", "emergency_contact"] },
        Appointment: { extraFields: ["insurance_number", "referral_code"] },
      },
      complianceRequirements: ["lfpdppp", "hipaa"],
      terminology: { client: "paciente", booking: "cita", provider: "doctor" },
    },
    {
      id: "retail",
      name: "Retail / Comercio",
      description: "Overlay para comercio y retail",
      entityModifications: {
        Product: { extraFields: ["sku", "barcode", "tax_category"] },
        Order: { extraFields: ["shipping_method", "tracking_number"] },
      },
      complianceRequirements: ["pci_dss"],
      terminology: { client: "cliente", item: "producto", transaction: "venta" },
    },
  ];

  for (const ov of overlays) {
    await prisma.industryOverlay.upsert({
      where: { id: ov.id },
      update: { name: ov.name, description: ov.description, entityModifications: ov.entityModifications, complianceRequirements: ov.complianceRequirements, terminology: ov.terminology },
      create: { id: ov.id, name: ov.name, description: ov.description, entityModifications: ov.entityModifications, complianceRequirements: ov.complianceRequirements, terminology: ov.terminology },
    });
  }
  console.log(`  ${overlays.length} industry overlays seeded`);

  // ── Demo Organization + User ──
  const passwordHash = await bcrypt.hash("demo1234", 12);

  const org = await prisma.organization.upsert({
    where: { slug: "demo-org" },
    update: {},
    create: {
      name: "Demo Organization",
      slug: "demo-org",
      plan: "PRO",
    },
  });

  await prisma.user.upsert({
    where: { email: "demo@saasfactory.dev" },
    update: {},
    create: {
      orgId: org.id,
      email: "demo@saasfactory.dev",
      name: "Demo Admin",
      role: "OWNER",
      passwordHash,
      authProvider: "email",
    },
  });
  console.log("  Demo user seeded: demo@saasfactory.dev / demo1234");

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
