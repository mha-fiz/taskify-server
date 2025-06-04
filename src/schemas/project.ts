import { z } from "zod"

export const getProjectSchema = z.object({ workspaceId: z.string() })
export const updateProjectQuerySchema = z.object({ workspaceId: z.string() })

export const createProjectSchema = z.object({
  name: z.string().min(3, "Name too short").max(32, "Name too long"),
  image: z.union([
    z.instanceof(File),
    z
      .string()
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
  ]),
  workspaceId: z.string(),
})

export const updateProjectSchema = z.object({
  name: z.string().min(3, "Name too short").max(32, "Name too long").optional(),
  image: z.union([
    z.instanceof(File),
    z
      .string()
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
  ]),
})
