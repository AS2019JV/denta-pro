import { z } from 'zod'

const boundedText = (max: number) => z.string().trim().min(1).max(max)

export const signupSchema = z.object({
  title: z.enum(['Dr.', 'Dra.', 'Lic.', '']).default('Dr.'),
  firstName: boundedText(100),
  lastName: boundedText(100),
  email: z.string().trim().max(254).email().transform(value => value.toLowerCase()),
  password: z.string().min(12).max(128),
  phoneRaw: z.string().trim().max(32).default(''),
  countryCode: z.string().regex(/^\+\d{1,4}$/).default('+593'),
  practiceName: boundedText(160),
  practiceSize: z.enum(['small', 'medium', 'large']),
  address: boundedText(300).default('Location Pending'),
})
