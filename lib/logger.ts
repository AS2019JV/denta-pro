export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Mask an email address to protect personal data (e.g. "jdoe@example.com" -> "j***@example.com")
 */
export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return '[MASKED_EMAIL]';
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  return `${local[0]}***@${domain}`;
}

/**
 * Mask an Ecuadorian national cédula or personal document ID (e.g. "1712345678" -> "******5678")
 */
export function maskCedula(cedula?: string | null): string {
  if (!cedula || typeof cedula !== 'string') return '';
  const trimmed = cedula.trim();
  if (trimmed.length <= 4) return '****';
  return '*'.repeat(trimmed.length - 4) + trimmed.slice(-4);
}

/**
 * Mask a phone number (e.g. "+593991234567" -> "******4567")
 */
export function maskPhone(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return '****';
  return '*'.repeat(trimmed.length - 4) + trimmed.slice(-4);
}

const SENSITIVE_SECRET_KEYS = new Set([
  'password',
  'token',
  'token_hash',
  'hashed_token',
  'code',
  'secret',
  'service_role_key',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'private_key',
  'api_key',
]);

const CEDULA_IDENTIFIER_KEYS = new Set([
  'cedula',
  'cédula',
  'identification',
  'document_id',
  'dni',
  'passport',
  'pasaporte',
]);

const CONTACT_EMAIL_KEYS = new Set([
  'email',
  'correo',
]);

const CONTACT_PHONE_KEYS = new Set([
  'phone',
  'telefono',
  'teléfono',
  'celular',
  'mobile',
]);

const CLINICAL_HEALTH_KEYS = new Set([
  'medical_conditions',
  'allergies',
  'systemic_diseases',
  'diagnosis',
  'diagnoses',
  'prescriptions',
  'prescription_data',
  'odontogram',
  'odontogram_data',
  'periodontogram_state',
  'clinical_notes',
  'notes',
  'antecedentes',
  'hcu033_data',
]);

/**
 * Recursively sanitize objects, arrays, and strings to eliminate PII/PHI leakage in logs.
 */
export function sanitizePII(value: any, seen = new WeakSet<object>()): any {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle primitives
  if (typeof value === 'string') {
    // Redact 10-digit Ecuadorian cédula pattern in free text (6 digits masked, last 4 preserved)
    let sanitized = value.replace(/\b(\d{6})(\d{4})\b/g, '******$2');
    // Redact email addresses in free text
    sanitized = sanitized.replace(
      /\b([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/g,
      '$1***@$2'
    );
    return sanitized;
  }

  if (typeof value !== 'object') {
    return value;
  }

  // Handle Error instances
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizePII(value.message, seen),
      stack: process.env.NODE_ENV === 'development' ? value.stack : undefined,
    };
  }

  // Prevent circular reference crashes
  if (seen.has(value)) {
    return '[CIRCULAR]';
  }
  seen.add(value);

  // Handle Arrays
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePII(item, seen));
  }

  // Handle plain objects
  const sanitizedObj: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_SECRET_KEYS.has(lowerKey)) {
      sanitizedObj[key] = '[REDACTED]';
    } else if (CEDULA_IDENTIFIER_KEYS.has(lowerKey)) {
      sanitizedObj[key] = typeof val === 'string' ? maskCedula(val) : '[MASKED_ID]';
    } else if (CONTACT_EMAIL_KEYS.has(lowerKey)) {
      sanitizedObj[key] = typeof val === 'string' ? maskEmail(val) : '[MASKED_EMAIL]';
    } else if (CONTACT_PHONE_KEYS.has(lowerKey)) {
      sanitizedObj[key] = typeof val === 'string' ? maskPhone(val) : '[MASKED_PHONE]';
    } else if (CLINICAL_HEALTH_KEYS.has(lowerKey)) {
      sanitizedObj[key] = '[CLINICAL_DATA_OMITTED]';
    } else {
      sanitizedObj[key] = sanitizePII(val, seen);
    }
  }

  return sanitizedObj;
}

export const logger = {
  log: (level: LogLevel, message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const sanitizedMessage = sanitizePII(message);
    const sanitizedData = data !== undefined ? sanitizePII(data) : undefined;

    if (process.env.NODE_ENV === 'development') {
      const formattedMessage = `[${timestamp}] [${level.toUpperCase()}]: ${sanitizedMessage}`;
      console[level](formattedMessage, sanitizedData !== undefined ? sanitizedData : '');
    } else {
      console[level](
        JSON.stringify({
          timestamp,
          level,
          message: sanitizedMessage,
          data: sanitizedData,
        })
      );
    }
  },
  info: (message: string, data?: any) => logger.log('info', message, data),
  warn: (message: string, data?: any) => logger.log('warn', message, data),
  error: (message: string, data?: any) => logger.log('error', message, data),
};
