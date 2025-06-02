import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"
import { requireAuthMiddleware } from "~/middlewares.js"
import { MemberRole, type RequiredAuthContext } from "~/types.js"
import prisma from "~lib/db.js"

const app = new Hono<RequiredAuthContext>()

app.get("/:workspaceId/check-member", requireAuthMiddleware, async (c) => {
  const user = c.get("user")
  const { workspaceId } = c.req.param()

  try {
    const isMember = await prisma.members.findFirst({
      where: {
        userId: user.id,
        workspaceId,
      },
    })

    if (isMember) {
      return c.json({
        success: false,
      })
    }

    return c.json({
      success: true,
    })
  } catch (error) {
    console.error(error)
    return c.json(
      {
        success: false,
        error: {
          code: 500,
          message:
            error instanceof Error ? error.message : "Internal server error",
        },
      },
      500
    )
  }
})

app.get(
  "/",
  requireAuthMiddleware,
  zValidator("query", z.object({ workspaceId: z.string() })),
  async (c) => {
    const { workspaceId } = c.req.valid("query")
    const user = c.get("user")

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

      const members = await prisma.members.findMany({
        where: { workspaceId },
      })

      const populatedMembers = await Promise.all(
        members.map(async (member) => {
          const memberData = await prisma.user.findFirst({
            where: { id: member.userId },
          })

          return {
            ...member,
            name: memberData?.name ?? "",
            email: memberData?.email ?? "",
          }
        })
      )

      return c.json({
        success: true,
        data: {
          members: populatedMembers,
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

app.delete(
  "/:memberId",
  requireAuthMiddleware,
  zValidator("json", z.object({ workspaceId: z.string() })),
  async (c) => {
    const user = c.get("user")
    const { memberId } = c.req.param()
    const { workspaceId } = c.req.valid("json")

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

      const memberToDelete = await prisma.members.findFirst({
        where: { userId: memberId, workspaceId },
      })

      if (!memberToDelete) {
        return c.json(
          {
            success: false,
            error: {
              code: 404,
              message: "The member to remove not found",
            },
          },
          404
        )
      }

      const totalMembers = await prisma.members.count({
        where: { workspaceId },
      })

      if (totalMembers === 1) {
        return c.json(
          {
            success: false,
            error: {
              code: 400,
              message: "Cannot delete the last member of workspace",
            },
          },
          400
        )
      }

      if (
        isMember.userId !== memberToDelete.userId &&
        isMember.role !== "ADMIN"
      ) {
        return c.json(
          { success: false, error: { code: 401, message: "Unauthorized" } },
          401
        )
      }

      await prisma.members.delete({
        where: { id: memberToDelete.id },
      })

      return c.json({
        success: true,
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

app.patch(
  "/:memberId",
  requireAuthMiddleware,
  zValidator(
    "json",
    z.object({ role: z.nativeEnum(MemberRole), workspaceId: z.string() })
  ),
  async (c) => {
    const user = c.get("user")
    const { memberId } = c.req.param()
    const { workspaceId, role } = c.req.valid("json")

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

      const memberToUpdate = await prisma.members.findFirst({
        where: { userId: memberId, workspaceId },
      })

      if (!memberToUpdate) {
        return c.json(
          {
            success: false,
            error: {
              code: 404,
              message: "The member to update not found",
            },
          },
          404
        )
      }

      const totalMembers = await prisma.members.count({
        where: { workspaceId },
      })

      if (totalMembers === 1) {
        return c.json(
          {
            success: false,
            error: {
              code: 400,
              message: "Cannot change the role of the last member of workspace",
            },
          },
          400
        )
      }

      if (isMember.role !== "ADMIN") {
        return c.json(
          { success: false, error: { code: 401, message: "Unauthorized" } },
          401
        )
      }

      const updatedMember = await prisma.members.update({
        where: { id: memberToUpdate.id },
        data: { role },
      })

      return c.json({
        success: true,
        data: { member: updatedMember },
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
