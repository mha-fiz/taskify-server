import { zValidator } from "@hono/zod-validator"
import { createAppWithAuth } from "~/factory.js"
import { IMAGE_FOLDER, uploadToImagekit } from "~/lib/imagekit.js"
import { requireAuthMiddleware } from "~/middlewares.js"
import {
  createProjectSchema,
  getProjectSchema,
  updateProjectQuerySchema,
  updateProjectSchema,
} from "~/schemas/project.js"
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

app.get(
  "/:projectId",
  zValidator("query", getProjectSchema),
  requireAuthMiddleware,
  async (c) => {
    const { projectId } = c.req.param()
    const { workspaceId } = c.req.valid("query")
    const user = c.get("user")

    try {
      const [isMember, project] = await prisma.$transaction([
        prisma.members.findFirst({ where: { userId: user.id, workspaceId } }),
        prisma.projects.findFirst({ where: { id: projectId } }),
      ])

      if (!isMember) {
        return c.json(
          { success: false, error: { code: 401, message: "Unauthorized" } },
          401
        )
      }

      return c.json({
        success: true,
        data: { project },
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

app.patch(
  "/:projectId",
  zValidator("query", updateProjectQuerySchema),
  zValidator("form", updateProjectSchema),
  requireAuthMiddleware,
  async (c) => {
    const { name, image } = c.req.valid("form")
    const { workspaceId } = c.req.valid("query")
    const { projectId } = c.req.param()
    const user = c.get("user")

    const [isAuthorized, isProjectExist] = await prisma.$transaction([
      prisma.members.findFirst({
        where: {
          workspaceId,
          userId: user.id,
          role: "ADMIN",
        },
      }),
      prisma.projects.findFirst({
        where: { id: projectId },
      }),
    ])

    if (!isProjectExist) {
      return c.json(
        { success: false, error: { code: 404, message: "Project not found" } },
        404
      )
    }

    if (!isAuthorized) {
      return c.json(
        {
          success: false,
          error: {
            status: 401,
            message: "Unauthorized",
          },
        },
        401
      )
    }

    let imageUrl = ""
    let imageId = ""
    let uploadedImage: any

    try {
      if (image instanceof File) {
        const uploaded = await uploadToImagekit(
          image,
          name ?? "update-icon",
          IMAGE_FOLDER.PROJECT_ICON
        )
        uploadedImage = uploaded
        imageUrl = uploaded.thumbnailUrl
        imageId = uploaded.fileId
      }

      const updateData: {
        name?: string
        imageUrl?: string | null
        imageId?: string | null
      } = {}

      if (name) {
        updateData.name = name
      }

      if (uploadedImage) {
        updateData.imageUrl = imageUrl
        updateData.imageId = imageId
      }

      const project = await prisma.projects.update({
        where: { id: projectId },
        data: updateData,
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
