import catchAsync from "../../shared/catchAsync";
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import { authService } from "./auth.service";

const login = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    const { accessToken, refreshToken } = result;
    res.cookie("accessToken", accessToken, {
        secure: true,
        httpOnly: true,
        sameSite: "none",
        maxAge: 1000 * 60 * 15, // 15 minutes
    });
    res.cookie("refreshToken", refreshToken, {
        secure: true,
        httpOnly: true,
        sameSite: "none",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Login successful",
        data: {
            needPasswordChange: result.needPasswordChange,
        },
    });
});

export const authController = {
    login,
};
