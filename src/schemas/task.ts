import { z } from "zod"
import { TaskStatus } from "~/types.js"

export const getAllTasksSchema = z.object({
  workspaceId: z.string(),
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

export const taskFilterSchema = z.object({
  workspaceId: z.string(),
  projectId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  dueDate: z.string().date().optional(),
  searchTerm: z.string().min(1).optional(),
  page: z
    .string()
    .transform((val) => parseInt(val))
    .pipe(z.number().min(1))
    .default("1"),
  limit: z
    .string()
    .transform((val) => parseInt(val))
    .pipe(z.number().min(1).max(100))
    .default("10"),
  sortBy: z
    .enum(["createdAt", "position", "dueDate", "status", "name"])
    .default("position"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
})
