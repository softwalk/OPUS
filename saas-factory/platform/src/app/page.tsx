import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Zap,
  Box,
  Shield,
  Layers,
  Code,
  Rocket,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Generacion con IA",
    description: "Claude Opus y Sonnet generan codigo production-ready a partir de tu descripcion.",
  },
  {
    icon: Layers,
    title: "10 Blueprints",
    description: "CRM, Inventario, Booking, LMS, Facturacion, Tickets, Proyectos, EHR, Marketplace, PMS.",
  },
  {
    icon: Shield,
    title: "Seguridad incluida",
    description: "Auth, RBAC, multi-tenancy con RLS, CSRF, validacion de inputs, audit log.",
  },
  {
    icon: Code,
    title: "Codigo limpio",
    description: "Next.js 15, TypeScript, Prisma, Tailwind, shadcn/ui. Codigo que puedes personalizar.",
  },
  {
    icon: Rocket,
    title: "Deploy automatico",
    description: "Docker container listo para produccion. Deploy en minutos, no en semanas.",
  },
  {
    icon: Box,
    title: "CRUD completo",
    description: "API REST, formularios, listados, detalle, paginacion. Todo generado automaticamente.",
  },
];

const STEPS = [
  { num: "1", title: "Describe tu idea", desc: "Escribe en lenguaje natural que quieres construir" },
  { num: "2", title: "IA clasifica", desc: "Selecciona blueprint, entidades y roles automaticamente" },
  { num: "3", title: "Confirma y ajusta", desc: "Revisa la especificacion y personaliza lo que necesites" },
  { num: "4", title: "Genera y despliega", desc: "En 5-10 minutos tienes tu app funcionando" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Box className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">SaaS Factory</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Iniciar Sesion</Button>
            </Link>
            <Link href="/register">
              <Button>Comenzar Gratis</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-gray-50 px-4 py-1.5 text-sm text-muted-foreground mb-6">
          <Zap className="h-4 w-4 text-primary" />
          Powered by Claude AI
        </div>
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          Genera tu SaaS
          <br />
          <span className="text-primary">en minutos, no meses</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Describe lo que quieres construir y nuestra IA genera una aplicacion SaaS completa:
          base de datos, API, frontend, autenticacion, permisos y deploy.
          Production-ready desde el dia uno.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/register">
            <Button size="lg" className="text-base px-8">
              Comenzar Gratis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="text-base px-8">
              Ver Demo
            </Button>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-gray-50/50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold mb-12">Como funciona</h2>
          <div className="grid gap-8 md:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.num} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white text-lg font-bold">
                  {step.num}
                </div>
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold mb-12">Todo incluido</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="pt-6">
                  <feature.icon className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stack */}
      <section className="border-t bg-gray-50/50 py-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Stack tecnologico de produccion</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Cada app generada usa las mismas tecnologias que usan las startups mas exitosas.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {["Next.js 15", "TypeScript", "PostgreSQL", "Prisma", "Tailwind CSS", "shadcn/ui", "NextAuth", "Docker", "Redis", "Zod"].map((tech) => (
              <span key={tech} className="inline-flex items-center gap-1 rounded-full border bg-white px-4 py-2 text-sm font-medium">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Listo para construir tu SaaS?</h2>
          <p className="text-muted-foreground mb-8">
            Crea tu cuenta gratis y genera tu primera aplicacion en menos de 15 minutos.
          </p>
          <Link href="/register">
            <Button size="lg" className="text-base px-10">
              Crear Cuenta Gratis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Box className="h-4 w-4" />
            <span>SaaS Factory</span>
          </div>
          <p>Pedir lo minimo, generar lo maximo.</p>
        </div>
      </footer>
    </div>
  );
}
