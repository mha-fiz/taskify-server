import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

import { requireAuthMiddleware } from "~/middlewares.js"
import prisma from "~lib/db.js"
import { IMAGE_FOLDER, uploadToImagekit } from "~/lib/imagekit.js"
import { generateInviteCode } from "~/lib/utils.js"
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
} from "~/schemas/workspace.js"
import { createAppWithAuth } from "~/factory.js"

const app = createAppWithAuth()

app.get("/", requireAuthMiddleware, async (c) => {
  const user = c.get("user")
  try {
    const membersOf = await prisma.members.findMany({
      where: {
        userId: user.id,
      },
      select: {
        workspaceId: true,
      },
    })

    if (!membersOf.length) {
      return c.json({
        success: true,
        data: { workspaces: [] },
      })
    }

    const memberWorkspaceIds = membersOf.map((member) => member.workspaceId)

    const workspaces = await prisma.workspace.findMany({
      where: {
        id: {
          in: memberWorkspaceIds,
        },
      },
    })

    return c.json({
      success: true,
      data: { workspaces },
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
})

app.get("/:workspaceId", requireAuthMiddleware, async (c) => {
  const { workspaceId } = c.req.param()
  try {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
      },
    })

    return c.json({
      success: true,
      data: { workspace },
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
})

app.post(
  "/",
  zValidator("form", createWorkspaceSchema),
  requireAuthMiddleware,
  async (c) => {
    const { name, image } = c.req.valid("form")

    const session = c.get("session")

    let imageUrl = ""
    let imageId = ""
    let uploadedData: any

    try {
      if (image instanceof File) {
        const uploaded = await uploadToImagekit(
          image,
          name,
          IMAGE_FOLDER.WORKSPACE_ICON
        )
        uploadedData = uploaded
        imageUrl = uploaded.thumbnailUrl
        imageId = uploaded.fileId
      }

      const workspace = await prisma.workspace.create({
        data: {
          userId: session.userId,
          inviteCode: generateInviteCode(15),
          name,
          imageUrl,
          imageId,
          member: {
            create: {
              userId: session.userId,
              role: "ADMIN",
            },
          },
        },
      })

      return c.json({
        success: true,
        data: {
          workspace,
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
  "/:workspaceId",
  zValidator("form", updateWorkspaceSchema),
  requireAuthMiddleware,
  async (c) => {
    const { name, image } = c.req.valid("form")
    const { workspaceId } = c.req.param()
    const user = c.get("user")

    const isAuthorized = await prisma.members.findFirst({
      where: {
        workspaceId,
        userId: user.id,
        role: "ADMIN",
      },
    })

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
    let uploadedData: any

    try {
      if (image instanceof File) {
        const uploaded = await uploadToImagekit(
          image,
          name ?? "update-icon",
          IMAGE_FOLDER.WORKSPACE_ICON
        )
        uploadedData = uploaded
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

      if (uploadedData) {
        updateData.imageUrl = imageUrl
        updateData.imageId = imageId
      }

      const workspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data: updateData,
      })

      return c.json({
        success: true,
        data: {
          workspace,
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

app.post(
  "/:workspaceId/reset-invite-link",
  requireAuthMiddleware,
  async (c) => {
    const { workspaceId } = c.req.param()
    const user = c.get("user")

    const isAuthorized = await prisma.members.findFirst({
      where: {
        workspaceId,
        userId: user.id,
        role: "ADMIN",
      },
    })

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

    try {
      const newCode = generateInviteCode(15)
      console.log("newcode: ", newCode)
      const workspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          inviteCode: newCode,
        },
      })

      return c.json({
        success: true,
        data: {
          workspace,
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

app.post(
  "/:workspaceId/join",
  requireAuthMiddleware,
  zValidator("json", z.object({ code: z.string() })),
  async (c) => {
    const user = c.get("user")
    const { workspaceId } = c.req.param()
    const { code } = c.req.valid("json")

    try {
      const isAlreadyMember = await prisma.members.findFirst({
        where: {
          workspaceId,
          userId: user.id,
        },
      })

      if (isAlreadyMember) {
        return c.json(
          {
            error: {
              code: 400,
              message: "Already a member of the workspace",
            },
          },
          400
        )
      }

      const workspace = await prisma.workspace.findFirst({
        where: {
          id: workspaceId,
        },
      })

      if (!workspace) {
        return c.json({ error: { code: 404, message: "Workspace not found" } })
      }

      if (workspace.inviteCode !== code) {
        return c.json({ error: { code: 401, message: "Invalid invite code" } })
      }

      await prisma.members.create({
        data: {
          workspaceId,
          role: "USER",
          userId: user.id,
        },
      })

      return c.json({
        success: true,
        data: {
          workspaceId: workspace.id,
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

app.delete("/:workspaceId", requireAuthMiddleware, async (c) => {
  const user = c.get("user")
  const { workspaceId } = c.req.param()

  try {
    const isCreator = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        AND: {
          userId: user.id,
        },
      },
    })

    if (!isCreator) {
      return c.json(
        {
          success: false,
          error: {
            code: 401,
            message: "Unauthorized to delete workspace",
          },
        },
        401
      )
    }

    await prisma.workspace.delete({
      where: { id: workspaceId },
    })

    return c.json({
      success: true,
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
})

export default app
