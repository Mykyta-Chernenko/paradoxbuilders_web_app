export interface EmailTemplate {
  subject: string;
  preheader: string;
  headline: string;
  body: string;
  ctaText: string;
}

// TODO: Add your email templates here
// Example:
// import { templates1 } from "./templates1.ts";
//
// const templates: Record<number, EmailTemplate> = {
//   ...templates1,
// };

const templates: Record<number, EmailTemplate> = {};

export function getEmailTemplate(templateNumber: number): EmailTemplate | null {
  return templates[templateNumber] || null;
}

export function getTotalTemplates(): number {
  return Object.keys(templates).length;
}
