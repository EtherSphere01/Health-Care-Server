import nodemailer from "nodemailer";
import config from "../../../config";
import httpStatus from "http-status";
import ApiError from "../../errors/ApiError";

const emailSender = async (
    email: string,
    html: string,
    subject: string = "Reset Password Link",
) => {
    const fromEmail = config.emailSender.email;
    const appPass = config.emailSender.app_pass;

    if (!fromEmail || !appPass) {
        throw new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            "Email sender is not configured (EMAIL/APP_PASS missing)",
        );
    }

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // Use `true` for port 465, `false` for all other ports
        auth: {
            user: fromEmail,
            pass: appPass,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    try {
        await transporter.sendMail({
            from: `"Nexus Health" <${fromEmail}>`,
            to: email,
            subject,
            html,
        });
    } catch (err) {
        throw new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            err instanceof Error
                ? `Failed to send email: ${err.message}`
                : "Failed to send email",
        );
    }
};

export default emailSender;
