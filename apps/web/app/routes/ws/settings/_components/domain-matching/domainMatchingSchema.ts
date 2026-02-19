import { z } from "zod";

export const domainMatchingSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  roleId: z.string().min(1, "Role is required"),
  verificationEmail: z.string().email("Must be a valid email"),
});

export type DomainMatchingFormData = z.infer<typeof domainMatchingSchema>;
