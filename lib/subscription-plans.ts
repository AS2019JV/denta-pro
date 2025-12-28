export type PlanTier = 'start' | 'pro' | 'enterprise';

export interface SubscriptionPlan {
    id: PlanTier;
    name: string;
    price: number;
    description: string;
    features: string[];
    kushkiPlanId: string; // ID configured in Kushki Console
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
    {
        id: 'start',
        name: 'Start',
        price: 29.00,
        description: 'Ideal para consultorios individuales.',
        features: ["1 Doctor", "Agenda básica", "Historia clínica simple", "5GB Almacenamiento"],
        kushkiPlanId: 'plan_start_monthly'
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 59.00,
        description: 'La opción favorita para clínicas en crecimiento.',
        features: ["Hasta 3 Doctores", "Agenda Avanzada + WhatsApp", "Odontograma 3D", "Facturación Electrónica"],
        kushkiPlanId: 'plan_pro_monthly'
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: 99.00,
        description: 'Para clínicas grandes y redes.',
        features: ["Doctores Ilimitados", "Multisede", "API Access", "Soporte Prioritario 24/7"],
        kushkiPlanId: 'plan_enterprise_monthly'
    }
];

export function getPlan(id: string): SubscriptionPlan | undefined {
    return SUBSCRIPTION_PLANS.find(p => p.id === id);
}
