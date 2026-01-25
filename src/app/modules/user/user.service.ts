import bcrypt from "bcryptjs";
import { createPatientInput } from "./user.interface";
import config from "../../../config";

const createPatient = async (payload: createPatientInput) => {
    const hashedPassword = await bcrypt.hash(
        payload.password,
        config.bcrypt_salt as string,
    );
};

export const userService = {
    createPatient,
};
