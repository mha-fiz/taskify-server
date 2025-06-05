import { z } from "zod"
import { TaskStatus } from "~/types.js"

export const getTaskQuery = z.object({
  workspaceId: z.string(),
  projectId: z.string().nullish(),
  assigneeId: z.string().nullish(),
  search: z.string().nullish(),
  dueDate: z.string().nullish(),
  status: z.nativeEnum(TaskStatus).nullish(),
})

export const createTaskSchema = z.object({
  projectId: z.string(),
  workspaceId: z.string(),
  status: z.nativeEnum(TaskStatus),
  dueDate: z.coerce.date(),
  name: z.string().min(3),
  assigneeId: z.string(),
  description: z.string().optional(),
})
