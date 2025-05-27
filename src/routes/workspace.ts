import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { requireAuthMiddleware } from "~/middlewares.js";
import prisma from "~lib/db.js";
import type { RequiredAuthContext } from "~/types.js";
import { uploadToImagekit } from "~/lib/imagekit.js";
import { generateInviteCode } from "~/lib/utils.js";

const workspaceRoutes = new Hono<RequiredAuthContext>();

workspaceRoutes.get("/", requireAuthMiddleware, async (c) => {
  const user = c.get("user");
  try {
    const membersOf = await prisma.members.findMany({
      where: {
        userId: user.id,
      },
      select: {
        workspaceId: true,
      },
    });

    if (!membersOf.length) {
      return c.json({
        success: true,
        data: { workspaces: [] },
      });
    }

    const memberWorkspaceIds = membersOf.map((member) => member.workspaceId);

    const workspaces = await prisma.workspace.findMany({
      where: {
        id: {
          in: memberWorkspaceIds,
        },
      },
    });

    return c.json({
      success: true,
      data: { workspaces },
    });
  } catch (error) {
    console.error(error);
    return c.json({
      success: false,
      error: {
        code: error instanceof Error ? 400 : 500,
        message:
          error instanceof Error ? error.message : "Something went wrong",
      },
    });
  }
});

const createWorkspaceSchema = z.object({
  name: z.string().min(3, "Name too short").max(32, "Name too long"),
  image: z.union([
    z.instanceof(File),
    z
      .string()
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
  ]),
});

workspaceRoutes.post(
  "/",
  zValidator("form", createWorkspaceSchema),
  requireAuthMiddleware,
  async (c) => {
    const { name, image } = c.req.valid("form");

    const session = c.get("session");

    let imageUrl = "";
    let imageId = "";
    let uploadedData: any;

    try {
      if (image instanceof File) {
        const uploaded = await uploadToImagekit(image, "test-file");
        uploadedData = uploaded;
        imageUrl = uploaded.thumbnailUrl;
        imageId = uploaded.fileId;
      }

      const data = {
        uploadedData,
        userId: session.userId,
        inviteCode: generateInviteCode(15),
        name,
        imageUrl,
        imageId,
      };

      console.log("data to create: ", data);

      const workspace = await prisma.workspace.create({
        data: {
          userId: session.userId,
          inviteCode: generateInviteCode(15),
          name,
          imageUrl,
          imageId,
        },
      });

      await prisma.members.create({
        data: {
          workspaceId: workspace.id,
          userId: session.userId,
          role: "ADMIN",
        },
      });

      return c.json({
        success: true,
        data: {
          workspace,
        },
      });
    } catch (error) {
      console.error(error);
      return c.json({
        success: false,
        message: JSON.stringify(error),
      });
    }
  }
);

export default workspaceRoutes;
