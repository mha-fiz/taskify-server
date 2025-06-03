import { zValidator } from "@hono/zod-validator";
import { createAppWithAuth } from "~/factory.js";
import { requireAuthMiddleware } from "~/middlewares.js";
import { getProjectSchema } from "~/schemas/project.js";
import prisma from "~lib/db.js";

const app = createAppWithAuth();

export default app;

app.get(
  "/",
  requireAuthMiddleware,
  zValidator("query", getProjectSchema),
  async (c) => {
    const user = c.get("user");
    const { workspaceId } = c.req.valid("query");

    try {
      const isMember = await prisma.members.findFirst({
        where: { userId: user.id, workspaceId },
      });

      if (!isMember) {
        return c.json(
          { success: false, error: { code: 401, message: "Unauthorized" } },
          401
        );
      }

      const projects = await prisma.projects.findMany({
        where: { workspaceId },
        orderBy: [{ createdAt: "desc" }],
      });

      return c.json({
        success: true,
        data: { projects },
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
        500
      );
    }
  }
);
