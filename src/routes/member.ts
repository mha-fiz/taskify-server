import { Hono } from "hono";
import { requireAuthMiddleware } from "~/middlewares.js";
import type { RequiredAuthContext } from "~/types.js";
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
      500
    );
  }
});

export default app;
