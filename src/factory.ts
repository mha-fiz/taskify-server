import { createFactory } from "hono/factory";
import type { RequiredAuthContext } from "./types.js";

const factory = createFactory<RequiredAuthContext>();

export const createAppWithAuth = () => factory.createApp();
