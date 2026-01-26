import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import config from "../../config";

const generateToken = (
    payload: any,
    expiresIn: SignOptions["expiresIn"],
    secret: Secret,
) => {
    const token = jwt.sign(payload, secret, {
        algorithm: "HS256",
        expiresIn,
    });

    return token;
};

const verifyToken = (token: string, secret: Secret) => {
    try {
        const decoded = jwt.verify(token, secret);
        return decoded;
    } catch (error) {
        throw new Error("Invalid or expired token");
    }
};

export const jwtHelper = {
    generateToken,
    verifyToken,
};
