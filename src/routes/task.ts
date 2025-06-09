import { zValidator } from "@hono/zod-validator"
import { createAppWithAuth } from "~/factory.js"
import { requireAuthMiddleware } from "~/middlewares.js"
import {
  createTaskSchema,
  getAllTasksSchema,
  taskFilterSchema,
} from "~/schemas/task.js"
import prisma from "~lib/db.js"

const app = createAppWithAuth()

app.get(
  "/search",
  zValidator("query", taskFilterSchema),
  requireAuthMiddleware,
  async (c) => {
    const user = c.get("user")
    const filters = c.req.valid("query")
    try {
      const isMember = await prisma.members.findFirst({
        where: {
          userId: user.id,
          workspaceId: filters.workspaceId,
        },
      })

      if (!isMember) {
        return c.json(
          { success: false, error: { code: 401, message: "Unauthorized" } },
          401
        )
      }

      const whereClause: any = {
        workspaceId: filters.workspaceId,
      }

      if (filters.assigneeId) {
        whereClause.assigneeId = filters.assigneeId
      }

      if (filters.status) {
        whereClause.status = filters.status
      }

      if (filters.projectId) {
        whereClause.projectId = filters.projectId
      }

      if (filters.dueDate) {
        whereClause.dueDate = new Date(filters.dueDate)
      }

      if (filters.searchTerm) {
        whereClause.name = {
          contains: filters.searchTerm,
          mode: "insensitive",
        }
      }

      const skip = (filters.page - 1) * filters.limit
      const orderBy: any = {}
      orderBy[filters.sortBy] = filters.sortOrder

      const [tasks, tasksCount] = await prisma.$transaction([
        prisma.tasks.findMany({
          where: whereClause,
          orderBy,
          skip,
          take: filters.limit,
        }),
        prisma.tasks.count({ where: whereClause }),
      ])

      const totalPages = Math.ceil(tasksCount / filters.limit)
      const hasNextPage = filters.page < totalPages
      const hasPrevPage = filters.page > 1

      return c.json({
        success: true,
        data: {
          tasks: tasks,
          pagination: {
            currentPage: filters.page,
            totalPages: totalPages,
            totalItems: tasksCount,
            itemsPerPage: filters.limit,
            hasNextPage: hasNextPage,
            hasPrevPage: hasPrevPage,
          },
          appliedFilters: {
            workspaceId: filters.workspaceId || null,
            projectId: filters.projectId || null,
            assigneeId: filters.assigneeId || null,
            status: filters.status || null,
            searchTerm: filters.searchTerm || null,
            date: filters.dueDate || null,
            sortBy: filters.sortBy || null,
            sortOrder: filters.sortOrder || null,
            page: filters.page || null,
            limit: filters.limit || null,
          },
        },
      })
    } catch (error) {
      console.error(error)
      return c.json(
        {
          success: false,
          error: {
            code: 500,
            message: JSON.stringify(error) || "Internal server error",
          },
        },
        500
      )
    }
  }
)

app.get(
  "/:projectId",
  zValidator("query", getAllTasksSchema),
  requireAuthMiddleware,
  async (c) => {
    const user = c.get("user")
    const { projectId } = c.req.param()
    const { workspaceId } = c.req.valid("query")

    try {
      const [isMember, project] = await prisma.$transaction([
        prisma.members.findFirst({
          where: { userId: user.id, workspaceId },
        }),
        prisma.projects.findUnique({
          where: { id: projectId },
          include: { workspace: true },
        }),
      ])

      if (!isMember) {
        return c.json(
          { success: false, error: { code: 401, message: "Unauthorized" } },
          401
        )
      }

      if (!project) {
        return c.json(
          {
            success: false,
            error: { code: 404, message: "Project not found" },
          },
          404
        )
      }

      const tasks = await prisma.tasks.findMany({
        where: { projectId },
        include: {
          assignee: {
            select: {
              id: true,
              userId: true,
              role: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              workspaceId: true,
            },
          },
        },
      })

      return c.json({
        success: true,
        data: {
          tasks,
          project: {
            id: project.id,
            name: project.name,
            workspace: project.workspace.name,
          },
          total: tasks.length,
        },
      })
    } catch (error) {
      console.error(error)
      return c.json(
        {
          success: false,
          error: {
            code: 500,
            message: JSON.stringify(error) || "Internal server error",
          },
        },
        500
      )
    }
  }
)

app.post(
  "/",
  zValidator("json", createTaskSchema),
  //   requireAuthMiddleware,
  async (c) => {
    // const user = c.get("user")
    const user = { id: "cmavrn6BlsAAaQPECgLmaTNU7pDhxayK" }
    const {
      assigneeId,
      dueDate,
      name,
      projectId,
      status,
      workspaceId,
      description,
    } = c.req.valid("json")

    try {
      const [isMember, highestPositionTask] = await prisma.$transaction([
        prisma.members.findFirst({ where: { userId: user.id, workspaceId } }),
        prisma.tasks.findFirst({
          where: { status, workspaceId },
          orderBy: { position: "asc" },
        }),
      ])

      if (!isMember) {
        return c.json(
          { success: false, error: { code: 401, message: "Unauthorized" } },
          401
        )
      }

      const newPosition = highestPositionTask?.position
        ? highestPositionTask.position + 1000
        : 1000

      const newTask = await prisma.tasks.create({
        data: {
          assigneeId: isMember.id,
          status,
          workspaceId,
          projectId,
          dueDate: new Date(dueDate),
          name,
          position: newPosition,
          description,
        },
      })

      return c.json({
        success: true,
        data: { task: newTask },
      })
    } catch (error) {
      console.error(error)
      return c.json(
        {
          success: false,
          error: {
            code: 500,
            message: JSON.stringify(error) || "Internal server error",
          },
        },
        500
      )
    }
  }
)

export default app
