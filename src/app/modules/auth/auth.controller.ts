import { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../../config";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { AuthServices } from "./auth.service";

const loginUser = catchAsync(async (req: Request, res: Response) => {
    const isProd = config.env === "production";
    const accessTokenExpiresIn = config.jwt.expires_in as string;
    const refreshTokenExpiresIn = config.jwt.refresh_token_expires_in as string;

    // convert accessTokenExpiresIn to milliseconds
    let accessTokenMaxAge = 0;
    const accessTokenUnit = accessTokenExpiresIn.slice(-1);
    const accessTokenValue = parseInt(accessTokenExpiresIn.slice(0, -1));
    if (accessTokenUnit === "y") {
        accessTokenMaxAge = accessTokenValue * 365 * 24 * 60 * 60 * 1000;
    } else if (accessTokenUnit === "M") {
        accessTokenMaxAge = accessTokenValue * 30 * 24 * 60 * 60 * 1000;
    } else if (accessTokenUnit === "w") {
        accessTokenMaxAge = accessTokenValue * 7 * 24 * 60 * 60 * 1000;
    } else if (accessTokenUnit === "d") {
        accessTokenMaxAge = accessTokenValue * 24 * 60 * 60 * 1000;
    } else if (accessTokenUnit === "h") {
        accessTokenMaxAge = accessTokenValue * 60 * 60 * 1000;
    } else if (accessTokenUnit === "m") {
        accessTokenMaxAge = accessTokenValue * 60 * 1000;
    } else if (accessTokenUnit === "s") {
        accessTokenMaxAge = accessTokenValue * 1000;
    } else {
        accessTokenMaxAge = 1000 * 60 * 60; // default 1 hour
    }

    // convert refreshTokenExpiresIn to milliseconds
    let refreshTokenMaxAge = 0;
    const refreshTokenUnit = refreshTokenExpiresIn.slice(-1);
    const refreshTokenValue = parseInt(refreshTokenExpiresIn.slice(0, -1));
    if (refreshTokenUnit === "y") {
        refreshTokenMaxAge = refreshTokenValue * 365 * 24 * 60 * 60 * 1000;
    } else if (refreshTokenUnit === "M") {
        refreshTokenMaxAge = refreshTokenValue * 30 * 24 * 60 * 60 * 1000;
    } else if (refreshTokenUnit === "w") {
        refreshTokenMaxAge = refreshTokenValue * 7 * 24 * 60 * 60 * 1000;
    } else if (refreshTokenUnit === "d") {
        refreshTokenMaxAge = refreshTokenValue * 24 * 60 * 60 * 1000;
    } else if (refreshTokenUnit === "h") {
        refreshTokenMaxAge = refreshTokenValue * 60 * 60 * 1000;
    } else if (refreshTokenUnit === "m") {
        refreshTokenMaxAge = refreshTokenValue * 60 * 1000;
    } else if (refreshTokenUnit === "s") {
        refreshTokenMaxAge = refreshTokenValue * 1000;
    } else {
        refreshTokenMaxAge = 1000 * 60 * 60 * 24 * 30; // default 30 days
    }
    const result = await AuthServices.loginUser(req.body);
    const { refreshToken, accessToken } = result;
    res.cookie("accessToken", accessToken, {
        secure: isProd,
        httpOnly: true,
        sameSite: isProd ? "none" : "lax",
        maxAge: accessTokenMaxAge,
    });
    res.cookie("refreshToken", refreshToken, {
        secure: isProd,
        httpOnly: true,
        sameSite: isProd ? "none" : "lax",
        maxAge: refreshTokenMaxAge,
    });

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Logged in successfully!",
        data: {
            needPasswordChange: result.needPasswordChange,
            accessToken,
            refreshToken,
        },
    });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
    const cookieRefreshToken = req.cookies.refreshToken;
    const bodyRefreshToken = (req.body as { refreshToken?: string } | undefined)
        ?.refreshToken;
    const refreshToken = cookieRefreshToken || bodyRefreshToken;
    /*
  EXPIRES_IN=7d 

REFRESH_TOKEN_EXPIRES_IN=1y 
  */
    const accessTokenExpiresIn = config.jwt.expires_in as string;
    const refreshTokenExpiresIn = config.jwt.refresh_token_expires_in as string;

    // convert accessTokenExpiresIn to milliseconds
    let accessTokenMaxAge = 0;
    const accessTokenUnit = accessTokenExpiresIn.slice(-1);
    const accessTokenValue = parseInt(accessTokenExpiresIn.slice(0, -1));
    if (accessTokenUnit === "y") {
        accessTokenMaxAge = accessTokenValue * 365 * 24 * 60 * 60 * 1000;
    } else if (accessTokenUnit === "M") {
        accessTokenMaxAge = accessTokenValue * 30 * 24 * 60 * 60 * 1000;
    } else if (accessTokenUnit === "w") {
        accessTokenMaxAge = accessTokenValue * 7 * 24 * 60 * 60 * 1000;
    } else if (accessTokenUnit === "d") {
        accessTokenMaxAge = accessTokenValue * 24 * 60 * 60 * 1000;
    } else if (accessTokenUnit === "h") {
        accessTokenMaxAge = accessTokenValue * 60 * 60 * 1000;
    } else if (accessTokenUnit === "m") {
        accessTokenMaxAge = accessTokenValue * 60 * 1000;
    } else if (accessTokenUnit === "s") {
        accessTokenMaxAge = accessTokenValue * 1000;
    } else {
        accessTokenMaxAge = 1000 * 60 * 60; // default 1 hour
    }

    // convert refreshTokenExpiresIn to milliseconds
    let refreshTokenMaxAge = 0;
    const refreshTokenUnit = refreshTokenExpiresIn.slice(-1);
    const refreshTokenValue = parseInt(refreshTokenExpiresIn.slice(0, -1));
    if (refreshTokenUnit === "y") {
        refreshTokenMaxAge = refreshTokenValue * 365 * 24 * 60 * 60 * 1000;
    } else if (refreshTokenUnit === "M") {
        refreshTokenMaxAge = refreshTokenValue * 30 * 24 * 60 * 60 * 1000;
    } else if (refreshTokenUnit === "w") {
        refreshTokenMaxAge = refreshTokenValue * 7 * 24 * 60 * 60 * 1000;
    } else if (refreshTokenUnit === "d") {
        refreshTokenMaxAge = refreshTokenValue * 24 * 60 * 60 * 1000;
    } else if (refreshTokenUnit === "h") {
        refreshTokenMaxAge = refreshTokenValue * 60 * 60 * 1000;
    } else if (refreshTokenUnit === "m") {
        refreshTokenMaxAge = refreshTokenValue * 60 * 1000;
    } else if (refreshTokenUnit === "s") {
        refreshTokenMaxAge = refreshTokenValue * 1000;
    } else {
        refreshTokenMaxAge = 1000 * 60 * 60 * 24 * 30; // default 30 days
    }

    const result = await AuthServices.refreshToken(refreshToken);
    res.cookie("accessToken", result.accessToken, {
        secure: config.env === "production",
        httpOnly: true,
        sameSite: config.env === "production" ? "none" : "lax",
        maxAge: accessTokenMaxAge,
    });

    res.cookie("refreshToken", result.refreshToken, {
        secure: config.env === "production",
        httpOnly: true,
        sameSite: config.env === "production" ? "none" : "lax",
        maxAge: refreshTokenMaxAge,
    });

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Access token generated successfully!",
        data: {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        },
    });
});

const changePassword = catchAsync(
    async (req: Request & { user?: any }, res: Response) => {
        const user = req.user;

        const result = await AuthServices.changePassword(user, req.body);

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Password Changed successfully",
            data: result,
        });
    },
);

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
    const isTestMode = process.env.ENABLE_TEST_ENDPOINTS === "1";
    const result = await AuthServices.forgotPassword(req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Check your email!",
        data: isTestMode ? (result ?? null) : null,
    });
});

const resetPassword = catchAsync(
    async (req: Request & { user?: any }, res: Response) => {
        // Accept token from Authorization header OR request body (Postman collection uses body.token)
        const authHeader = req.headers.authorization;
        const tokenFromHeader = authHeader
            ? authHeader.replace("Bearer ", "")
            : null;

        const tokenFromBody =
            typeof (req.body as any)?.token === "string"
                ? String((req.body as any).token)
                : null;

        // Prefer body token (forgot-password flow) over Authorization header.
        const token = tokenFromBody ?? tokenFromHeader;
        const user = req.user; // Will be populated if authenticated via middleware

        // Normalize payload field names (collection uses newPassword)
        const password =
            typeof (req.body as any)?.password === "string"
                ? String((req.body as any).password)
                : typeof (req.body as any)?.newPassword === "string"
                  ? String((req.body as any).newPassword)
                  : undefined;

        const payload = {
            email:
                typeof (req.body as any)?.email === "string"
                    ? String((req.body as any).email)
                    : undefined,
            password,
        };

        await AuthServices.resetPassword(token, payload, user);

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Password Reset!",
            data: null,
        });
    },
);

const getMe = catchAsync(
    async (req: Request & { user?: any }, res: Response) => {
        const authHeader = req.headers.authorization;
        const rawHeaderToken =
            typeof authHeader === "string" ? authHeader : undefined;
        const tokenFromHeader = rawHeaderToken?.startsWith("Bearer ")
            ? rawHeaderToken.slice("Bearer ".length)
            : rawHeaderToken;

        const accessToken = req.cookies.accessToken || tokenFromHeader;

        const user = {
            accessToken,
        };

        const result = await AuthServices.getMe(user);

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "User retrieved successfully",
            data: result,
        });
    },
);

const requestPatientRegistrationOtp = catchAsync(
    async (req: Request, res: Response) => {
        const result = await AuthServices.requestPatientRegistrationOtp(
            req.body,
        );

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "OTP sent to your email",
            data: result,
        });
    },
);

const verifyPatientRegistrationOtp = catchAsync(
    async (req: Request, res: Response) => {
        const result = await AuthServices.verifyPatientRegistrationOtp(
            req.body,
        );

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Account created successfully",
            data: result,
        });
    },
);

export const AuthController = {
    loginUser,
    refreshToken,
    changePassword,
    forgotPassword,
    resetPassword,
    getMe,
    requestPatientRegistrationOtp,
    verifyPatientRegistrationOtp,
};
