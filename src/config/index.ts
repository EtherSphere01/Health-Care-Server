import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
    node_env: process.env.NODE_ENV,
    port: process.env.PORT,
    database_url: process.env.DATABASE_URL,
    bcrypt_salt: Number(process.env.BCRYPT_SALT ?? 10),
    cloudinary: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    },
    jwt: {
        access_secret_key: process.env.JWT_ACCESS_SECRET,
        refresh_secret_key: process.env.JWT_REFRESH_SECRET,
        access_token_expires_in: process.env.ACCESS_TOKEN_JWT_EXPIRES_IN,
        refresh_token_expires_in: process.env.REFRESH_TOKEN_JWT_EXPIRES_IN,
    },
};
