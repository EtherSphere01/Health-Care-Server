import { UserRole } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { jwtHelper } from "../helper/jwtHelper";
import config from "../../config";

const authMiddleware = (...roles: string[]) => {
    return async (
        req: Request & { user?: any },
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const token = req.cookies?.accessToken;
            if (!token) {
                throw new Error("Unauthorized: No token provided");
            }
            const verifyToken = jwtHelper.verifyToken(
                token,
                config.jwt.access_secret_key!,
            );
            req.user = verifyToken;
            if (!roles.includes(req.user.role)) {
                throw new Error(
                    "Forbidden: You don't have enough permission to access this resource",
                );
            }

            return next();
        } catch (error) {
            next(error);
        }
    };
};

export default authMiddleware;
