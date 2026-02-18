import { WizardContainer } from "@/components/discovery/wizard-container";

export default function NewAppPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Crear Nueva App</h1>
        <p className="text-muted-foreground">
          Describe tu idea y generaremos una aplicacion SaaS completa
        </p>
      </div>
      <WizardContainer />
    </div>
  );
}
