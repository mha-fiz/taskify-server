import { serve } from "@hono/node-server";
import { Hono, type Context, type Next } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { config } from "dotenv";
import { auth } from "~lib/auth.js";
import { setAuthMiddleware } from "./middlewares.js";
import type { AuthContext } from "./types.js";
import workspaceRoutes from "./routes/workspace.js";

config({ debug: process.env.NODE_ENV !== "production" });

const app = new Hono<AuthContext>().basePath("/api");
app.use(logger());
app.use(
  "*", // or replace with "*" to enable cors for all routes
  cors({
    origin: "http://localhost:3001", // replace with your origin
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);
app.use("*", setAuthMiddleware);
app.on(["POST", "GET"], "/auth/**", (c) => auth.handler(c.req.raw));
app.route("/workspace", workspaceRoutes);

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
