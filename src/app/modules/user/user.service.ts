import bcrypt from "bcryptjs";
import config from "../../../config";
import { prisma } from "../../shared/prisma";
import { Request } from "express";
import { fileUploader } from "../../helper/fileUploader";

const createPatient = async (req: Request) => {
    const saltRounds = Number.isFinite(config.bcrypt_salt)
        ? (config.bcrypt_salt as number)
        : 10;
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

    if (req.file) {
        const uploadedFile = await fileUploader.uploadToCloudinary(req.file);
        req.body.patient.profilePhoto = uploadedFile?.secure_url;
    }

    const result = await prisma.$transaction(async (tnx: any) => {
        await tnx.user.create({
            data: {
                email: req.body.patient.email,
                password: hashedPassword,
            },
        });
        return await tnx.patient.create({
            data: req.body.patient,
        });
    });
    return result;
};

const createDoctor = async (req: Request) => {
    const saltRounds = Number.isFinite(config.bcrypt_salt)
        ? (config.bcrypt_salt as number)
        : 10;
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

    if (req.file) {
        const uploadedFile = await fileUploader.uploadToCloudinary(req.file);
        req.body.doctor.profilePhoto = uploadedFile?.secure_url;
    }

    const result = await prisma.$transaction(async (tnx: any) => {
        await tnx.user.create({
            data: {
                email: req.body.doctor.email,
                password: hashedPassword,
                role: "DOCTOR",
            },
        });
        return await tnx.doctor.create({
            data: req.body.doctor,
        });
    });

    return result;
};

const createAdmin = async (req: Request) => {
    const saltRounds = Number.isFinite(config.bcrypt_salt)
        ? (config.bcrypt_salt as number)
        : 10;
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

    if (req.file) {
        const uploadedFile = await fileUploader.uploadToCloudinary(req.file);
        req.body.admin.profilePhoto = uploadedFile?.secure_url;
    }

    const result = await prisma.$transaction(async (tnx: any) => {
        await tnx.user.create({
            data: {
                email: req.body.admin.email,
                password: hashedPassword,
                role: "ADMIN",
            },
        });
        return await tnx.admin.create({
            data: req.body.admin,
        });
    });

    return result;
};

export const userService = {
    createPatient,
    createDoctor,
    createAdmin,
};
