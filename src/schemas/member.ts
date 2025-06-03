import { z } from "zod";
import { MemberRole } from "~/types.js";

export const getMemberSchema = z.object({ workspaceId: z.string() });
export const deleteMemberSchema = z.object({ workspaceId: z.string() });
export const updateMemberSchema = z.object({
  role: z.nativeEnum(MemberRole),
  workspaceId: z.string(),
});
