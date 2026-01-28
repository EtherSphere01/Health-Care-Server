import bcrypt from "bcryptjs";
import config from "../../../config";
import { prisma } from "../../shared/prisma";
import { Request } from "express";
import { fileUploader } from "../../helpers/fileUploader";
import { paginationHelper } from "../../helpers/paginationHelper";
import { Prisma } from "@prisma/client";
import { userSearchAbleFields } from "./user.constant";

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

const getAllFromDB = async ({
    params,
    filters,
    options,
}: {
    params?: any;
    // backwards-compat: some callers may pass `filters` instead of `params`
    filters?: any;
    options?: any;
} = {}) => {
    const effectiveParams = params ?? filters ?? {};
    const effectiveOptions = options ?? {};
    const { page, skip, limit, sortBy, sortOrder } =
        paginationHelper.calculatePagination(effectiveOptions);

    const { searchTerm, ...rawFiltersData } = effectiveParams;

    // Backwards-compat: older clients may send `status`; the actual Prisma field is `userStatus`.
    const filtersData: Record<string, unknown> = { ...rawFiltersData };
    if (
        typeof filtersData.userStatus === "undefined" &&
        typeof filtersData.status !== "undefined"
    ) {
        filtersData.userStatus = filtersData.status;
    }
    delete (filtersData as any).status;

    const normalizeEnumValue = (value: unknown) =>
        typeof value === "string" ? value.toUpperCase() : value;

    const andConditions: Prisma.UserWhereInput[] = [];

    const normalizedSearchTerm =
        typeof searchTerm === "string" ? searchTerm.trim() : "";

    if (normalizedSearchTerm) {
        const upper = normalizedSearchTerm.toUpperCase();

        const orConditions: Prisma.UserWhereInput[] = userSearchAbleFields.map(
            (field) => ({
                [field]: {
                    contains: normalizedSearchTerm,
                    mode: "insensitive",
                },
            }),
        );

        // Enum fields can't use `contains`; only add equals when searchTerm matches a known enum.
        if (["PATIENT", "DOCTOR", "ADMIN"].includes(upper)) {
            orConditions.push({
                role: { equals: upper as any },
            });
        }

        if (["ACTIVE", "INACTIVE", "DELETED"].includes(upper)) {
            orConditions.push({
                userStatus: { equals: upper as any },
            });
        }

        andConditions.push({ OR: orConditions });
    }

    if (filtersData && Object.keys(filtersData).length > 0) {
        andConditions.push({
            AND: Object.entries(filtersData).map(([field, value]) => ({
                [field]: {
                    equals:
                        field === "role" || field === "userStatus"
                            ? normalizeEnumValue(value)
                            : value,
                },
            })),
        });
    }

    const whereConditions: Prisma.UserWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const users = await prisma.user.findMany({
        skip,
        take: limit,
        where: whereConditions,
        orderBy: sortBy ? { [sortBy]: sortOrder } : undefined,
    });

    const total = await prisma.user.count({
        where: whereConditions,
    });

    return {
        meta: {
            page,
            limit,
            total,
        },
        data: users,
    };
};

export const userService = {
    createPatient,
    createDoctor,
    createAdmin,
    getAllFromDB,
};
