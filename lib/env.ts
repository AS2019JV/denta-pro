import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Add other variables as they become necessary
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const _env = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  NODE_ENV: process.env.NODE_ENV,
});

if (!_env.success) {
  console.warn("⚠️ Invalid environment variables:", _env.error.format());
}

export const env = _env.success ? _env.data : {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  NODE_ENV: "development" as const,
};
