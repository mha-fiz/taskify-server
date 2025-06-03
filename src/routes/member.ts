import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuthMiddleware } from "~/middlewares.js";
import { MemberRole, type RequiredAuthContext } from "~/types.js";
import prisma from "~lib/db.js";

const app = new Hono<RequiredAuthContext>();

app.get("/:workspaceId/check-member", requireAuthMiddleware, async (c) => {
  const user = c.get("user");
  const { workspaceId } = c.req.param();

  try {
    const isMember = await prisma.members.findFirst({
      where: {
        userId: user.id,
        workspaceId,
      },
    });

    if (isMember) {
      return c.json({
        success: false,
      });
    }

    return c.json({
      success: true,
    });
  } catch (error) {
    console.error(error);
    return c.json(
      {
        success: false,
        error: {
          code: 500,
          message:
            error instanceof Error ? error.message : "Internal server error",
        },
      },
      500,
    );
  }
});

app.get(
  "/",
  requireAuthMiddleware,
  zValidator("query", z.object({ workspaceId: z.string() })),
  async (c) => {
    const { workspaceId } = c.req.valid("query");
    const user = c.get("user");

    try {
      const isMember = await prisma.members.findFirst({
        where: { userId: user.id, workspaceId },
      });

      if (!isMember) {
        return c.json(
          { success: false, error: { code: 401, message: "Unauthorized" } },
          401,
        );
      }

      const members = await prisma.members.findMany({
        where: { workspaceId },
      });

      const populatedMembers = await Promise.all(
        members.map(async (member) => {
          const memberData = await prisma.user.findFirst({
            where: { id: member.userId },
          });

          return {
            ...member,
            name: memberData?.name ?? "",
            email: memberData?.email ?? "",
          };
        }),
      );

      return c.json({
        success: true,
        data: {
          members: populatedMembers,
        },
      });
    } catch (error) {
      console.error(error);
      return c.json(
        {
          success: false,
          error: {
            code: 500,
            message: JSON.stringify(error) || "Internal server error",
          },
        },
        500,
      );
    }
  },
);

app.delete(
  "/:memberId",
  requireAuthMiddleware,
  zValidator("json", z.object({ workspaceId: z.string() })),
  async (c) => {
    const user = c.get("user");
    const { memberId } = c.req.param();
    const { workspaceId } = c.req.valid("json");

    try {
      const [isMember, memberToDelete, totalMembers] =
        await prisma.$transaction([
          prisma.members.findFirst({ where: { userId: user.id, workspaceId } }),
          prisma.members.findFirst({
            where: { userId: memberId, workspaceId },
          }),
          prisma.members.count({ where: { workspaceId } }),
        ]);

      if (!isMember) {
        return c.json(
          { success: false, error: { code: 401, message: "Unauthorized" } },
          401,
        );
      }

      if (!memberToDelete) {
        return c.json(
          {
            success: false,
            error: {
              code: 404,
              message: "The member to remove not found",
            },
          },
          404,
        );
      }

      if (totalMembers === 1) {
        return c.json(
          {
            success: false,
            error: {
              code: 400,
              message: "Cannot delete the last member of workspace",
            },
          },
          400,
        );
      }

      if (
        isMember.userId !== memberToDelete.userId &&
        isMember.role !== "ADMIN"
      ) {
        return c.json(
          { success: false, error: { code: 401, message: "Unauthorized" } },
          401,
        );
      }

      await prisma.members.delete({
        where: { id: memberToDelete.id },
      });

      return c.json({
        success: true,
        data: { member: memberToDelete },
      });
    } catch (error) {
      console.error(error);
      return c.json(
        {
          success: false,
          error: {
            code: 500,
            message: JSON.stringify(error) || "Internal server error",
          },
        },
        500,
      );
    }
  },
);

app.patch(
  "/:memberId",
  requireAuthMiddleware,
  zValidator(
    "json",
    z.object({ role: z.nativeEnum(MemberRole), workspaceId: z.string() }),
  ),
  async (c) => {
    const { memberId } = c.req.param();
    const user = c.get("user");
    const { role: newRole, workspaceId } = c.req.valid("json");

    try {
      const [currentMember, memberToUpdate, totalAdminCount] =
        await prisma.$transaction([
          prisma.members.findFirst({ where: { userId: user.id, workspaceId } }),
          prisma.members.findFirst({
            where: { userId: memberId, workspaceId },
          }),
          prisma.members.count({
            where: { role: MemberRole.ADMIN, workspaceId },
          }),
        ]);

      if (!currentMember) {
        return c.json(
          { success: false, error: { code: 401, message: "Unauthorized" } },
          401,
        );
      }

      if (currentMember.role !== MemberRole.ADMIN) {
        return c.json(
          { success: false, error: { code: 403, message: "Forbidden" } },
          403,
        );
      }

      if (!memberToUpdate) {
        return c.json(
          {
            success: false,
            error: {
              code: 404,
              message: "The member to update was not found in this workspace.",
            },
          },
          404,
        );
      }

      const isCurrentlyAdmin = memberToUpdate.role === MemberRole.ADMIN;
      const isDemoting = isCurrentlyAdmin && newRole === MemberRole.USER;

      if (isDemoting && totalAdminCount === 1) {
        return c.json(
          {
            success: false,
            error: {
              code: 400,
              message: "Cannot remove the last admin of this workspace.",
            },
          },
          400,
        );
      }

      const updatedMember = await prisma.members.update({
        where: { id: memberToUpdate.id },
        data: { role: newRole },
      });

      return c.json({
        success: true,
        data: { member: updatedMember },
      });
    } catch (error) {
      console.error(error);
      return c.json(
        {
          success: false,
          error: {
            code: 500,
            message: (error as Error).message || "Internal server error",
          },
        },
        500,
      );
    }
  },
);

export default app;
