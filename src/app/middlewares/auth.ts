import { UserRole } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { jwtHelper } from "../helper/jwtHelper";
import config from "../../config";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { prisma } from "../shared/prisma";
import { UserStatus } from "@prisma/client";

const authMiddleware = (...roles: string[]) => {
    return async (
        req: Request & { user?: any },
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const issueNewAccessTokenFromRefresh = async () => {
                const refreshToken = req.cookies?.refreshToken;
                if (!refreshToken) {
                    throw new Error("Unauthorized: No token provided");
                }

                const decodedRefresh = jwt.verify(
                    refreshToken,
                    config.jwt.refresh_secret_key!,
                ) as JwtPayload;

                const user = await prisma.user.findFirst({
                    where: {
                        id: decodedRefresh.userId as string,
                        email: decodedRefresh.email as string,
                        userStatus: UserStatus.ACTIVE,
                    },
                    select: {
                        id: true,
                        email: true,
                        role: true,
                    },
                });

                if (!user) {
                    throw new Error("Unauthorized: Invalid refresh token");
                }

                const tokenPayload = {
                    userId: user.id,
                    email: user.email,
                    role: user.role,
                };

                const newAccessToken = jwtHelper.generateToken(
                    tokenPayload,
                    config.jwt
                        .access_token_expires_in as SignOptions["expiresIn"],
                    config.jwt.access_secret_key as jwt.Secret,
                );

                res.cookie("accessToken", newAccessToken, {
                    secure: true,
                    httpOnly: true,
                    sameSite: "none",
                    maxAge: 1000 * 60 * 15,
                });

                return tokenPayload;
            };

            const accessToken = req.cookies?.accessToken;
            if (!accessToken) {
                req.user = await issueNewAccessTokenFromRefresh();
            } else {
                try {
                    const decodedAccess = jwt.verify(
                        accessToken,
                        config.jwt.access_secret_key!,
                    );
                    req.user = decodedAccess;
                } catch (error: any) {
                    if (error?.name === "TokenExpiredError") {
                        req.user = await issueNewAccessTokenFromRefresh();
                    } else {
                        throw new Error("Unauthorized: Invalid token");
                    }
                }
            }

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
