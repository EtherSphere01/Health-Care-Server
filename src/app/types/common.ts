import { UserRole } from "@prisma/client";

export type IJwtPayload = {
    userId: string;
    email: string;
    role: UserRole;
};
