import { z } from "zod";

export const reportSchema = z.object({
  overallScore: z.number().int().min(1).max(10),
  summary: z.string().min(1),
  competencies: z
    .array(
      z.object({
        name: z.string().min(1),
        score: z.number().int().min(1).max(10),
        evidence: z.string().min(1),
      })
    )
    .min(1),
  strengths: z.array(z.string()).min(1),
  improvements: z.array(z.string()).min(1),
  communicationNotes: z.string().min(1),
});

// Strips markdown code fences if the model wrapped its JSON in them.
export function cleanJsonText(text) {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
