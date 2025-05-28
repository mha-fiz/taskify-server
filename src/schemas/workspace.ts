import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(3, "Name too short").max(32, "Name too long"),
  image: z.union([
    z.instanceof(File),
    z
      .string()
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
  ]),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(3, "Name too short").max(32, "Name too long").optional(),
  image: z.union([
    z.instanceof(File),
    z
      .string()
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
  ]),
});
