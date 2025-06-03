import { z } from "zod";

export const getProjectSchema = z.object({ workspaceId: z.string() });
