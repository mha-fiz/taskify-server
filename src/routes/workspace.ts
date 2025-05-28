import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { requireAuthMiddleware } from "~/middlewares.js";
import prisma from "~lib/db.js";
import type { RequiredAuthContext } from "~/types.js";
import { uploadToImagekit } from "~/lib/imagekit.js";
import { generateInviteCode } from "~/lib/utils.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
} from "~/schemas/workspace.js";

const app = new Hono<RequiredAuthContext>();

app.get("/", requireAuthMiddleware, async (c) => {
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
        status: 500,
        message: JSON.stringify(error) || "Internal server error",
      },
    });
  }
});

app.get("/:workspaceId", requireAuthMiddleware, async (c) => {
  const { workspaceId } = c.req.param();
  try {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
      },
    });

    return c.json({
      success: true,
      data: { workspace },
    });
  } catch (error) {
    console.error(error);
    return c.json({
      success: false,
      error: {
        status: 500,
        message: JSON.stringify(error) || "Internal server error",
      },
    });
  }
});

app.post(
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
        const uploaded = await uploadToImagekit(image, name);
        uploadedData = uploaded;
        imageUrl = uploaded.thumbnailUrl;
        imageId = uploaded.fileId;
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
        error: {
          status: 500,
          message: JSON.stringify(error) || "Internal server error",
        },
      });
    }
  }
);

app.patch(
  "/:workspaceId",
  zValidator("form", updateWorkspaceSchema),
  requireAuthMiddleware,
  async (c) => {
    const { name, image } = c.req.valid("form");
    const { workspaceId } = c.req.param();
    const user = c.get("user");

    const isAuthorized = await prisma.members.findFirst({
      where: {
        workspaceId,
        userId: user.id,
        role: "ADMIN",
      },
    });

    if (!isAuthorized) {
      return c.json({
        success: false,
        error: {
          status: 401,
          message: "Unauthorized",
        },
      });
    }

    let imageUrl = "";
    let imageId = "";
    let uploadedData: any;

    try {
      if (image instanceof File) {
        const uploaded = await uploadToImagekit(image, name ?? "update-icon");
        uploadedData = uploaded;
        imageUrl = uploaded.thumbnailUrl;
        imageId = uploaded.fileId;
      }

      const updateData: {
        name?: string;
        imageUrl?: string | null;
        imageId?: string | null;
      } = {};

      if (name) {
        updateData.name = name;
      }

      if (uploadedData) {
        updateData.imageUrl = imageUrl;
        updateData.imageId = imageId;
      }

      const workspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data: updateData,
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
        error: {
          status: 500,
          message: JSON.stringify(error) || "Internal server error",
        },
      });
    }
  }
);

export default app;
