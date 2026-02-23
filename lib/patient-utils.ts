export const calculateProfileCompletion = (patient: any) => {
  let score = 0;
  const weights = {
    name: 10,
    lastName: 10,
    email: 10,
    phone: 10,
    birthDate: 10,
    cedula: 10,
    medicalConditions: 20, // Sum of specific flags or notes
    emergencyContact: 10,
    address: 10,
  };

  if (patient.name) score += weights.name;
  if (patient.lastName) score += weights.lastName;
  if (patient.email) score += weights.email;
  if (patient.phone) score += weights.phone;
  if (patient.birthDate) score += weights.birthDate;
  if (patient.cedula) score += weights.cedula;
  
  // Medical conditions check (if any critical flag is set or medicalConditions text exists)
  const hasMedicalInfo = 
    patient.hasDiabetes || 
    patient.hasHypertension || 
    patient.hasHeartDisease || 
    patient.isPregnant || 
    patient.allergies || 
    patient.medicalConditions;
    
  if (hasMedicalInfo) score += weights.medicalConditions;
  
  if (patient.emergencyContact || patient.emergencyPhone) score += weights.emergencyContact;
  if (patient.address || patient.city) score += weights.address;

  return Math.min(score, 100);
};

export const getCompletionColor = (score: number) => {
  if (score >= 90) return "bg-green-500";
  if (score >= 70) return "bg-blue-500";
  if (score >= 50) return "bg-yellow-500";
  return "bg-rose-500";
};

export const getCompletionLabel = (score: number) => {
  if (score === 100) return "Perfil Completo";
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Bueno";
  if (score >= 40) return "Incompleto";
  return "Crítico";
};

/**
 * Calculates the patient value/loyalty status based on appointments, billing, and clinic configuration
 */
export const getPatientLoyaltyStatus = (
  appointmentsCount: number = 0, 
  totalBilled: number = 0,
  config?: any
) => {
  const loyaltyConfig = config?.loyalty_config || {
    vip: { threshold_billed: 1000, threshold_appointments: 10, label: "VIP" },
    regular: { threshold_billed: 300, threshold_appointments: 3, label: "Regular" },
    new: { label: "Nuevo" }
  };

  if (appointmentsCount >= loyaltyConfig.vip.threshold_appointments || totalBilled >= loyaltyConfig.vip.threshold_billed) {
    return { key: "VIP", label: loyaltyConfig.vip.label, style: loyaltyConfig.vip.style || "premium" };
  }
  
  if (appointmentsCount >= loyaltyConfig.regular.threshold_appointments || totalBilled >= loyaltyConfig.regular.threshold_billed) {
    return { key: "Regular", label: loyaltyConfig.regular.label, style: loyaltyConfig.regular.style || "standard" };
  }
  
  return { key: "Nuevo", label: loyaltyConfig.new.label, style: loyaltyConfig.new.style || "neutral" };
};

/**
 * Returns the visual styling and icon mapping for the loyalty badge
 */
export const getLoyaltyBadgeData = (statusKey: string, style: string = "standard") => {
  const styles = {
    premium: "bg-primary text-primary-foreground border-none shadow-[0_0_15px_rgba(var(--primary),0.3)] font-black animate-pulse",
    standard: "bg-blue-50 text-blue-700 border-blue-200 font-bold",
    neutral: "bg-slate-50 text-slate-600 border-slate-200 font-medium",
  };

  const icons: Record<string, string> = {
    VIP: "Crown",
    Regular: "ShieldCheck",
    Nuevo: "Sparkles",
  };

  return {
    className: styles[style as keyof typeof styles] || styles.neutral,
    iconName: icons[statusKey] || "User",
  };
};
