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

/**
 * Validates an Ecuadorian Cédula de Identidad using the official Module 10 algorithm.
 * Returns true if the cédula is mathematically valid, false otherwise.
 * For non-10 digit strings (passports/foreign IDs), it returns { isValid: boolean, isForeignId: boolean }.
 */
export const validateEcuadorianCedula = (cedula: string): { isValid: boolean; isForeignId: boolean; reason?: string } => {
  if (!cedula || typeof cedula !== "string") {
    return { isValid: false, isForeignId: false, reason: "Cédula vacía o no proporcionada" };
  }

  const clean = cedula.trim();

  // If not exactly 10 digits or contains non-digits, check if valid foreign ID / passport
  if (!/^\d{10}$/.test(clean)) {
    // Foreign passports or international IDs: minimum 5 characters, alphanumeric
    if (clean.length >= 5 && clean.length <= 20) {
      return { isValid: true, isForeignId: true };
    }
    return { isValid: false, isForeignId: false, reason: "Longitud o formato inválido" };
  }

  // Province code (digits 1-2): 01 to 24, or 30 for special diplomatic/abroad cases
  const province = parseInt(clean.substring(0, 2), 10);
  if ((province < 1 || province > 24) && province !== 30) {
    return { isValid: false, isForeignId: false, reason: "Código de provincia no válido (01-24, 30)" };
  }

  // Third digit: 0 to 5 for natural person cédula
  const thirdDigit = parseInt(clean[2], 10);
  if (thirdDigit >= 6) {
    return { isValid: false, isForeignId: false, reason: "Tercer dígito no corresponde a persona natural (< 6)" };
  }

  // Coefficients for Module 10
  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    let product = parseInt(clean[i], 10) * coefficients[i];
    if (product >= 10) {
      product -= 9;
    }
    sum += product;
  }

  const mod = sum % 10;
  const verifierDigit = mod === 0 ? 0 : 10 - mod;

  if (verifierDigit !== parseInt(clean[9], 10)) {
    return { isValid: false, isForeignId: false, reason: "Dígito verificador de cédula no coincide (Módulo 10)" };
  }

  return { isValid: true, isForeignId: false };
};

export const ADULT_QUADRANTS = {
  Q1: [18, 17, 16, 15, 14, 13, 12, 11],
  Q2: [21, 22, 23, 24, 25, 26, 27, 28],
  Q3: [48, 47, 46, 45, 44, 43, 42, 41],
  Q4: [31, 32, 33, 34, 35, 36, 37, 38],
};

export const CHILD_QUADRANTS = {
  Q5: [55, 54, 53, 52, 51],
  Q6: [61, 62, 63, 64, 65],
  Q7: [85, 84, 83, 82, 81],
  Q8: [71, 72, 73, 74, 75],
};

/**
 * Calculates official MSP CPO-D and ceo-d epidemiological indices.
 * CPO-D (Permanent): C (Cariados) + P (Perdidos) + O (Obturados)
 * ceo-d (Deciduous): c (cariados) + e (extracción indicada) + o (obturados)
 */
export const calculateCPOceo = (teethState: Record<string, any>) => {
  let C = 0, P = 0, O = 0;
  let c = 0, e = 0, o = 0;

  const adultTeeth = Object.values(ADULT_QUADRANTS).flat();
  const childTeeth = Object.values(CHILD_QUADRANTS).flat();

  adultTeeth.forEach(id => {
    const t = teethState[id];
    if (!t) return;
    const hasCaries = Object.values(t.surfaces || {}).some((v: any) => v && v.startsWith('caries:red'));
    const isPerdido = t.condition === 'extraction' || t.condition === 'loss_other';
    const isObturado = Object.values(t.surfaces || {}).some((v: any) => v && v.startsWith('caries:blue')) || t.condition === 'crown';

    if (hasCaries) C++;
    else if (isPerdido) P++;
    else if (isObturado) O++;
  });

  childTeeth.forEach(id => {
    const t = teethState[id];
    if (!t) return;
    const hasCaries = Object.values(t.surfaces || {}).some((v: any) => v && v.startsWith('caries:red'));
    const isExtraccion = t.condition === 'extraction';
    const isObturado = Object.values(t.surfaces || {}).some((v: any) => v && v.startsWith('caries:blue')) || t.condition === 'crown';

    if (hasCaries) c++;
    else if (isExtraccion) e++;
    else if (isObturado) o++;
  });

  return {
    C, P, O, totalCPO: C + P + O,
    c, e, o, totalceo: c + e + o
  };
};
