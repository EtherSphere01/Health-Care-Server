import { UserStatus } from "@prisma/client";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import httpStatus from "http-status";
import { Secret } from "jsonwebtoken";
import config from "../../../config";
import { jwtHelpers } from "../../../helpers/jwtHelpers";
import prisma from "../../../shared/prisma";
import ApiError from "../../errors/ApiError";
import emailSender from "./emailSender";

function isValidEmail(email: string) {
    // Reasonable RFC-5322-ish check; the frontend also validates.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}
const loginUser = async (payload: { email: string; password: string }) => {
    const userData = await prisma.user.findUnique({
        where: {
            email: payload.email,
            status: UserStatus.ACTIVE,
        },
    });

    if (!userData) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid credentials");
    }

    const isCorrectPassword: boolean = await bcrypt.compare(
        payload.password,
        userData.password,
    );

    if (!isCorrectPassword) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid credentials");
    }
    const accessToken = jwtHelpers.generateToken(
        {
            email: userData.email,
            role: userData.role,
        },
        config.jwt.jwt_secret as Secret,
        config.jwt.expires_in as string,
    );

    const refreshToken = jwtHelpers.generateToken(
        {
            email: userData.email,
            role: userData.role,
        },
        config.jwt.refresh_token_secret as Secret,
        config.jwt.refresh_token_expires_in as string,
    );

    return {
        accessToken,
        refreshToken,
        needPasswordChange: userData.needPasswordChange,
    };
};

const refreshToken = async (token: string) => {
    let decodedData;
    try {
        decodedData = jwtHelpers.verifyToken(
            token,
            config.jwt.refresh_token_secret as Secret,
        );
    } catch (err) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized!");
    }

    const userData = await prisma.user.findUniqueOrThrow({
        where: {
            email: decodedData.email,
            status: UserStatus.ACTIVE,
        },
    });

    const accessToken = jwtHelpers.generateToken(
        {
            email: userData.email,
            role: userData.role,
        },
        config.jwt.jwt_secret as Secret,
        config.jwt.expires_in as string,
    );

    const refreshToken = jwtHelpers.generateToken(
        {
            email: userData.email,
            role: userData.role,
        },
        config.jwt.refresh_token_secret as Secret,
        config.jwt.refresh_token_expires_in as string,
    );

    return {
        accessToken,
        refreshToken,
        needPasswordChange: userData.needPasswordChange,
    };
};

const changePassword = async (user: any, payload: any) => {
    const userData = await prisma.user.findUniqueOrThrow({
        where: {
            email: user.email,
            status: UserStatus.ACTIVE,
        },
    });

    const isCorrectPassword: boolean = await bcrypt.compare(
        payload.oldPassword,
        userData.password,
    );

    if (!isCorrectPassword) {
        throw new Error("Password incorrect!");
    }

    const hashedPassword: string = await bcrypt.hash(
        payload.newPassword,
        Number(config.salt_round),
    );

    await prisma.user.update({
        where: {
            email: userData.email,
        },
        data: {
            password: hashedPassword,
            needPasswordChange: false,
        },
    });

    return {
        message: "Password changed successfully!",
    };
};

const forgotPassword = async (payload: { email: string }) => {
    const userData = await prisma.user.findUniqueOrThrow({
        where: {
            email: payload.email,
            status: UserStatus.ACTIVE,
        },
    });

    const resetPassToken = jwtHelpers.generateToken(
        { email: userData.email, userId: userData.id, role: userData.role },
        config.jwt.reset_pass_secret as Secret,
        config.jwt.reset_pass_token_expires_in as string,
    );

    const resetPassLink =
        config.reset_pass_link +
        `?email=${encodeURIComponent(userData.email)}&token=${resetPassToken}`;

    const isTestMode = process.env.ENABLE_TEST_ENDPOINTS === "1";
    if (!isTestMode) {
        await emailSender(
            userData.email,
            `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td align="center" style="padding: 40px 0;">
                        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <!-- Header -->
                            <tr>
                                <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;"> Nexus Health</h1>
                                </td>
                            </tr>
                            <!-- Content -->
                            <tr>
                                    <td style="padding: 40px;">
                                        <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                                        <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 24px;">
                                            Hello,
                                        </p>
                                        <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 24px;">
                                            We received a request to reset your password for your Nexus Health account. Click the button below to create a new password:
                                        </p>
                                    <!-- Button -->
                                    <table role="presentation" style="margin: 0 auto;">
                                        <tr>
                                            <td style="border-radius: 6px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                                <a href="${resetPassLink}" style="border: none; color: #ffffff; padding: 14px 32px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block; border-radius: 6px;">
                                                    Reset Password
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                    <p style="margin: 30px 0 20px 0; color: #666666; font-size: 14px; line-height: 20px;">
                                        Or copy and paste this link into your browser:
                                    </p>
                                    <p style="margin: 0 0 30px 0; color: #667eea; font-size: 14px; line-height: 20px; word-break: break-all;">
                                        ${resetPassLink}
                                    </p>
                                    <div style="border-top: 1px solid #eeeeee; padding-top: 20px; margin-top: 30px;">
                                        <p style="margin: 0 0 10px 0; color: #999999; font-size: 14px; line-height: 20px;">
                                            <strong>Security Notice:</strong>
                                        </p>
                                        <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #999999; font-size: 14px; line-height: 20px;">
                                            <li>This link will expire in 15 minutes</li>
                                            <li>If you didn't request this password reset, please ignore this email</li>
                                <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
                                    <p style="margin: 0 0 10px 0; color: #999999; font-size: 14px;">
                                        © ${new Date().getFullYear()} Nexus Health. All rights reserved.
                                    </p>
                            </tr>
                            <!-- Footer -->
                            <tr>
                                <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
                                    <p style="margin: 0 0 10px 0; color: #999999; font-size: 14px;">
                                        © ${new Date().getFullYear()} Nexus Health. All rights reserved.
                                    </p>
                                    <p style="margin: 0; color: #999999; font-size: 12px;">
                                        This is an automated email. Please do not reply.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `,
        );

        return;
    }

    // Test-mode: avoid SMTP dependency and return the token directly to the caller.
    return { resetToken: resetPassToken, resetLink: resetPassLink };
};

const resetPassword = async (
    token: string | null,
    payload: { email?: string; password?: string },
    user?: { email: string },
) => {
    let userEmail: string;

    // Case 1: Token-based reset (from forgot password email)
    if (token) {
        const decodedToken = jwtHelpers.verifyToken(
            token,
            config.jwt.reset_pass_secret as Secret,
        );

        if (!decodedToken) {
            throw new ApiError(
                httpStatus.FORBIDDEN,
                "Invalid or expired reset token!",
            );
        }

        // Verify email from token matches the email in payload
        if (payload.email && decodedToken.email !== payload.email) {
            throw new ApiError(
                httpStatus.FORBIDDEN,
                "Email mismatch! Invalid reset request.",
            );
        }

        userEmail = decodedToken.email;
    }
    // Case 2: Authenticated user with needPasswordChange (newly created admin/doctor)
    else if (user && user.email) {
        console.log({ user }, "needpassworchange");
        const authenticatedUser = await prisma.user.findUniqueOrThrow({
            where: {
                email: user.email,
                status: UserStatus.ACTIVE,
            },
        });

        // Verify user actually needs password change
        if (!authenticatedUser.needPasswordChange) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                "You don't need to reset your password. Use change password instead.",
            );
        }

        userEmail = user.email;
    } else {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Invalid request. Either provide a valid token or be authenticated.",
        );
    }

    if (!payload.password) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Password is required");
    }

    // hash password
    const password = await bcrypt.hash(
        payload.password,
        Number(config.salt_round),
    );

    // update into database
    await prisma.user.update({
        where: {
            email: userEmail,
        },
        data: {
            password,
            needPasswordChange: false,
        },
    });
};

const requestPatientRegistrationOtp = async (payload: {
    name: string;
    email: string;
    password: string;
}) => {
    const email = String(payload.email ?? "")
        .trim()
        .toLowerCase();
    const name = String(payload.name ?? "").trim();
    const password = String(payload.password ?? "");

    if (!name) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Name is required");
    }

    if (!isValidEmail(email)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid email address");
    }

    if (password.length < 6) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Password must be at least 6 characters",
        );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new ApiError(
            httpStatus.CONFLICT,
            "User with this email already exists",
        );
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, Number(config.salt_round));
    const passwordHash = await bcrypt.hash(password, Number(config.salt_round));

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.patientRegistrationOtp.upsert({
        where: { email },
        create: {
            email,
            otpHash,
            payload: {
                passwordHash,
                patient: {
                    name,
                    email,
                },
                role: UserRole.PATIENT,
            },
            expiresAt,
        },
        update: {
            otpHash,
            payload: {
                passwordHash,
                patient: {
                    name,
                    email,
                },
                role: UserRole.PATIENT,
            },
            attempts: 0,
            expiresAt,
        },
    });

    const isTestMode = process.env.ENABLE_TEST_ENDPOINTS === "1";
    if (!isTestMode) {
        await emailSender(
            email,
            `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2>Nexus Health - Verify your email</h2>
              <p>Your OTP code is:</p>
              <p style="font-size: 24px; font-weight: 700; letter-spacing: 2px;">${otp}</p>
              <p>This code will expire in 10 minutes.</p>
            </div>
            `,
            "Your OTP Code",
        );
        return { email };
    }

    // Test-mode: return OTP so automation doesn't depend on SMTP.
    return { email, otp };
};

const verifyPatientRegistrationOtp = async (payload: {
    email: string;
    otp: string;
}) => {
    const email = String(payload.email ?? "")
        .trim()
        .toLowerCase();
    const otp = String(payload.otp ?? "").trim();

    if (!isValidEmail(email)) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid email address");
    }
    if (!otp) {
        throw new ApiError(httpStatus.BAD_REQUEST, "OTP is required");
    }

    const record = await prisma.patientRegistrationOtp.findUnique({
        where: { email },
    });
    if (!record) {
        throw new ApiError(
            httpStatus.NOT_FOUND,
            "No pending registration found for this email",
        );
    }

    if (record.expiresAt.getTime() < Date.now()) {
        await prisma.patientRegistrationOtp.delete({ where: { email } });
        throw new ApiError(httpStatus.BAD_REQUEST, "OTP has expired");
    }

    if (record.attempts >= 5) {
        throw new ApiError(
            httpStatus.TOO_MANY_REQUESTS,
            "Too many invalid attempts. Please request a new OTP",
        );
    }

    const isMatch = await bcrypt.compare(otp, record.otpHash);
    if (!isMatch) {
        await prisma.patientRegistrationOtp.update({
            where: { email },
            data: { attempts: { increment: 1 } },
        });
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid OTP");
    }

    const passwordHash = (record.payload as any)?.passwordHash;
    const patientPayload = (record.payload as any)?.patient;
    const name = String(patientPayload?.name ?? "").trim();

    if (!passwordHash || !name) {
        throw new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            "Invalid pending registration payload",
        );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        await prisma.patientRegistrationOtp.delete({ where: { email } });
        throw new ApiError(
            httpStatus.CONFLICT,
            "User with this email already exists",
        );
    }

    await prisma.$transaction(async (tx) => {
        await tx.user.create({
            data: {
                email,
                password: passwordHash,
                role: UserRole.PATIENT,
                needPasswordChange: false,
            },
        });

        await tx.patient.create({
            data: {
                email,
                name,
            },
        });

        await tx.patientRegistrationOtp.delete({ where: { email } });
    });

    return { email };
};
const getMe = async (user: any) => {
    const accessToken = user.accessToken;
    const decodedData = jwtHelpers.verifyToken(
        accessToken,
        config.jwt.jwt_secret as Secret,
    );

    const userData = await prisma.user.findUniqueOrThrow({
        where: {
            email: decodedData.email,
            status: UserStatus.ACTIVE,
        },
        select: {
            id: true,
            email: true,
            role: true,
            needPasswordChange: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            admin: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    profilePhoto: true,
                    contactNumber: true,
                    isDeleted: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
            doctor: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    profilePhoto: true,
                    contactNumber: true,
                    address: true,
                    registrationNumber: true,
                    experience: true,
                    gender: true,
                    appointmentFee: true,
                    qualification: true,
                    currentWorkingPlace: true,
                    designation: true,
                    averageRating: true,
                    isDeleted: true,
                    createdAt: true,
                    updatedAt: true,
                    doctorSpecialties: {
                        include: {
                            specialities: true,
                        },
                    },
                },
            },
            patient: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    profilePhoto: true,
                    contactNumber: true,
                    address: true,
                    isDeleted: true,
                    createdAt: true,
                    updatedAt: true,
                    patientHealthData: true,
                },
            },
        },
    });

    return userData;
};

export const AuthServices = {
    loginUser,
    refreshToken,
    changePassword,
    forgotPassword,
    resetPassword,
    getMe,
    requestPatientRegistrationOtp,
    verifyPatientRegistrationOtp,
};
