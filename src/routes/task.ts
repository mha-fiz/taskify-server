import { zValidator } from "@hono/zod-validator"
import { createAppWithAuth } from "~/factory.js"
import { requireAuthMiddleware } from "~/middlewares.js"
import { createTaskSchema } from "~/schemas/task.js"
import prisma from "~lib/db.js"

const app = createAppWithAuth()

app.post(
  "/",
  zValidator("json", createTaskSchema),
  requireAuthMiddleware,
  async (c) => {
    const user = c.get("user")
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
          assigneeId,
          status,
          workspaceId,
          projectId,
          dueDate,
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
