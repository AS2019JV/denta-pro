export const getWhatsAppUrl = (phone: string, message?: string) => {
  // Remove non-numeric characters
  const cleanPhone = phone.replace(/\D/g, "");
  
  // Basic check: if phone starts with 0 (Ecuador/local), prepend 593 or default country code
  // In a real app, we'd handle country codes more robustly.
  let finalPhone = cleanPhone;
  if (finalPhone.startsWith("0")) {
    finalPhone = "593" + finalPhone.substring(1);
  } else if (!finalPhone.startsWith("593") && finalPhone.length === 9) {
    finalPhone = "593" + finalPhone;
  }

  const baseUrl = "https://wa.me/" + finalPhone;
  if (message) {
    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }
  return baseUrl;
};

export const getClinicWhatsAppMessage = (patientName: string, clinicName: string = "su Clínica Dental") => {
  return `Hola ${patientName}, le escribimos desde ${clinicName} para...`;
};
