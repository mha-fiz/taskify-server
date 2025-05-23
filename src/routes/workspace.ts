import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { requireAuthMiddleware } from "~/middlewares.js";
import prisma from "~lib/db.js";
import type { RequiredAuthContext } from "~/types.js";
import { uploadToImagekit } from "~/lib/imagekit.js";

const workspaceRoutes = new Hono<RequiredAuthContext>();

const postWorkspaceSchema = z.object({
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
  zValidator("form", postWorkspaceSchema),
  requireAuthMiddleware,
  async (c) => {
    const { name, image } = c.req.valid("form");

    const session = c.get("session");

    let imageUploadedUrl = "";
    let uploadedData: any;

    if (image instanceof File) {
      const uploaded = await uploadToImagekit(image, "test-file");
      uploadedData = uploaded;
    }

    try {
      const workspace = await prisma.workspace.create({
        data: {
          name,
          userId: session.userId,
          imageUrl: imageUploadedUrl,
        },
      });

      return c.json({
        success: true,
        workspace,
        uploadedData,
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
