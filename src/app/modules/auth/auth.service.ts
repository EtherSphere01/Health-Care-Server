import { UserStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import config from "../../../config";
import { jwtHelper } from "../../helper/jwtHelper";
import ApiError from "../../errors/apiError";
import httpStatus from "http-status";

const login = async (payload: { email: string; password: string }) => {
    const user = await prisma.user.findUniqueOrThrow({
        where: {
            email: payload.email,
            userStatus: UserStatus.ACTIVE,
        },
    });

    if (user) {
        const passwordMatch = await bcrypt.compare(
            payload.password,
            user.password,
        );
        if (!passwordMatch) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Invalid credentials");
        }

        const tokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };

        const accessToken = jwtHelper.generateToken(
            tokenPayload,
            config.jwt.access_token_expires_in as SignOptions["expiresIn"],
            config.jwt.access_secret_key as jwt.Secret,
        );

        const refreshToken = jwtHelper.generateToken(
            tokenPayload,
            config.jwt.refresh_token_expires_in as SignOptions["expiresIn"],
            config.jwt.refresh_secret_key as jwt.Secret,
        );

        return {
            accessToken,
            refreshToken,
            needPasswordChange: user.needPasswordChange,
        };
    } else {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid credentials");
    }
};

export const authService = {
    login,
};
