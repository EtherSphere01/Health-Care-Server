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

export const jwtHelper = {
    generateToken,
};
