import type { auth } from "./lib/auth.js";

type AuthUser = typeof auth.$Infer.Session.user;
type AuthSession = typeof auth.$Infer.Session.session;

export type AuthContext = {
  Variables: {
    user: AuthUser | null;
    session: AuthSession | null;
  };
};

export type RequiredAuthContext = {
  Variables: {
    user: AuthUser;
    session: AuthSession;
  };
};
