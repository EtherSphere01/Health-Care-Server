import dotenv from "dotenv";
import path from "path";

// Load .env from the project root (robust even if the process is started from a different cwd)
dotenv.config({ path: path.join(__dirname, "..", "..", "..", ".env") });

function normalizeOrigin(raw: string | undefined): string | undefined {
    const value = raw?.trim();
    if (!value) return undefined;
    try {
        return new URL(value).origin;
    } catch {
        return value.replace(/\/+$/g, "");
    }
}

export default {
    env: process.env.NODE_ENV,
    port: process.env.PORT,
    frontendUrl: normalizeOrigin(process.env.FRONTEND_URL),
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    salt_round: process.env.SALT_ROUND,
    openRouterApiKey:
        process.env.OPENROUTER_API_KEY ||
        process.env.OPENROUTERAPIKEY ||
        process.env.openrouterapikey,
    jwt: {
        jwt_secret: process.env.JWT_SECRET,
        expires_in: process.env.EXPIRES_IN,
        refresh_token_secret: process.env.REFRESH_TOKEN_SECRET,
        refresh_token_expires_in: process.env.REFRESH_TOKEN_EXPIRES_IN,
        reset_pass_secret: process.env.RESET_PASS_TOKEN,
        reset_pass_token_expires_in: process.env.RESET_PASS_TOKEN_EXPIRES_IN,
    },
    reset_pass_link: process.env.RESET_PASS_LINK,
    emailSender: {
        email: process.env.EMAIL,
        app_pass: process.env.APP_PASS,
    },
    cloudinary: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    },
};
