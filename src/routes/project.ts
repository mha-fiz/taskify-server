import { zValidator } from "@hono/zod-validator"
import { createAppWithAuth } from "~/factory.js"
import { IMAGE_FOLDER, uploadToImagekit } from "~/lib/imagekit.js"
import { requireAuthMiddleware } from "~/middlewares.js"
import { createProjectSchema, getProjectSchema } from "~/schemas/project.js"
import prisma from "~lib/db.js"

const app = createAppWithAuth()

export default app

app.get(
  "/",
  requireAuthMiddleware,
  zValidator("query", getProjectSchema),
  async (c) => {
    const user = c.get("user")
    const { workspaceId } = c.req.valid("query")

    try {
      const isMember = await prisma.members.findFirst({
        where: { userId: user.id, workspaceId },
      })

      if (!isMember) {
        return c.json(
          { success: false, error: { code: 401, message: "Unauthorized" } },
          401
        )
      }

      const projects = await prisma.projects.findMany({
        where: { workspaceId },
        orderBy: [{ createdAt: "desc" }],
      })

      return c.json({
        success: true,
        data: { projects },
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
  zValidator("form", createProjectSchema),
  requireAuthMiddleware,
  async (c) => {
    const { name, image, workspaceId } = c.req.valid("form")
    const user = c.get("user")
    try {
      const isMember = await prisma.members.findFirst({
        where: { workspaceId, userId: user.id },
      })

      if (!isMember) {
        return c.json(
          {
            success: false,
            error: { code: 401, message: "Unauthorized" },
          },
          401
        )
      }

      let imageUrl = ""
      let imageId = ""

      if (image instanceof File) {
        const uploaded = await uploadToImagekit(
          image,
          name,
          IMAGE_FOLDER.PROJECT_ICON
        )
        imageUrl = uploaded.thumbnailUrl
        imageId = uploaded.fileId
      }

      const project = await prisma.projects.create({
        data: {
          name,
          imageUrl,
          imageId,
          workspaceId,
        },
      })

      return c.json({
        success: true,
        data: {
          project,
        },
      })
    } catch (error) {
      console.error(error)
      return c.json({
        success: false,
        error: {
          code: 500,
          message: JSON.stringify(error) || "Internal server error",
        },
      })
    }
  }
)
