import { z } from "zod";

/**
 * Public Environment Variables
 * These are safe to expose to the frontend.
 * Next.js automatically injects any variable prefixed with `NEXT_PUBLIC_` to the client boundary.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_INVOICE_PROVIDER: z.string().optional(),
});

/**
 * Server Environment Variables
 * These should ONLY be accessed by the backend/API Routes.
 * Next.js will naturally omit non-NEXT_PUBLIC variables from the browser.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "Server role key is required on the backend"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  KUSHKI_PRIVATE_MERCHANT_ID: z.string().optional(),
  KUSHKI_PUBLIC_MERCHANT_ID: z.string().optional(),
  KUSHKI_ENVIRONMENT: z.string().optional(),
});

// A small utility function to wrap and execute our parsing securely.
const processEnv = () => {
  const isServer = typeof window === "undefined";

  const clientEnvData = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_INVOICE_PROVIDER: process.env.NEXT_PUBLIC_INVOICE_PROVIDER,
  };

  const parsedClient = clientSchema.safeParse(clientEnvData);

  if (!parsedClient.success) {
    console.error("❌ Invalid public environment variables:", parsedClient.error.format());
    // Provide safe defaults for the browser or Next.js prerendering to skip crashes
  }

  // Define defaults here, prioritizing valid values
  const finalClientEnv = parsedClient.success ? parsedClient.data : {
    NEXT_PUBLIC_SUPABASE_URL: clientEnvData.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: clientEnvData.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder_anon_key",
    NEXT_PUBLIC_APP_URL: clientEnvData.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    NEXT_PUBLIC_INVOICE_PROVIDER: clientEnvData.NEXT_PUBLIC_INVOICE_PROVIDER,
  };

  // Only validate server environment if we are running on the server
  if (isServer) {
    const serverEnvData = {
      NODE_ENV: process.env.NODE_ENV,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
      KUSHKI_PRIVATE_MERCHANT_ID: process.env.KUSHKI_PRIVATE_MERCHANT_ID,
      KUSHKI_PUBLIC_MERCHANT_ID: process.env.KUSHKI_PUBLIC_MERCHANT_ID,
      KUSHKI_ENVIRONMENT: process.env.KUSHKI_ENVIRONMENT,
    };

    const parsedServer = serverSchema.safeParse(serverEnvData);
    
    if (!parsedServer.success && process.env.NODE_ENV !== "production") {
      // It's acceptable to log this during development, but failing safely is key
      console.warn("⚠️ Invalid server environment variables:", parsedServer.error.format());
    }

    const finalServerEnv = parsedServer.success ? parsedServer.data : {
      NODE_ENV: "development" as const,
      SUPABASE_SERVICE_ROLE_KEY: serverEnvData.SUPABASE_SERVICE_ROLE_KEY || "mock_role_key",
      RESEND_API_KEY: serverEnvData.RESEND_API_KEY,
      RESEND_FROM_EMAIL: serverEnvData.RESEND_FROM_EMAIL || "Clinia + <onboarding@resend.dev>",
      KUSHKI_PRIVATE_MERCHANT_ID: serverEnvData.KUSHKI_PRIVATE_MERCHANT_ID,
      KUSHKI_PUBLIC_MERCHANT_ID: serverEnvData.KUSHKI_PUBLIC_MERCHANT_ID,
      KUSHKI_ENVIRONMENT: serverEnvData.KUSHKI_ENVIRONMENT || "dev",
    };

    return { ...finalClientEnv, ...finalServerEnv };
  }

  // The client side shouldn't know what these are, we safely typecast them for TypeScript support 
  // without resolving to the actual process values so no leaks can occur over the network.
  return { 
    ...finalClientEnv,
    NODE_ENV: "development" as const,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    RESEND_API_KEY: undefined,
    RESEND_FROM_EMAIL: undefined,
    KUSHKI_PRIVATE_MERCHANT_ID: undefined,
    KUSHKI_PUBLIC_MERCHANT_ID: undefined,
    KUSHKI_ENVIRONMENT: undefined,
  };
};

export const env = processEnv();
