import { createMiddleware } from "hono/factory";
import { auth } from "./lib/auth.js";
import type { AuthContext } from "./types.js";

export const setAuthMiddleware = createMiddleware<AuthContext>(
  async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      c.set("user", null);
      c.set("session", null);
      return next();
    }

    c.set("user", session.user);
    c.set("session", session.session);
    return next();
  }
);

export const requireAuthMiddleware = createMiddleware<AuthContext>(
  async (c, next) => {
    const session = c.get("session");

    if (!session) {
      return c.json(
        {
          success: false,
          message: "Unauthorized",
        },
        401
      );
    }

    await next();
  }
);
