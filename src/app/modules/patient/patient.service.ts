import { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { IOptions, paginationHelper } from "../../helpers/paginationHelper";
import { patientSearchableFields } from "./patient.constant";
import { IJwtPayload } from "../../types/common";
import httpStatus from "http-status";
import AppError from "../../errors/AppError";

const getAllFromDB = async (filters: any, options: IOptions) => {
    const { page, limit, skip, sortBy, sortOrder } =
        paginationHelper.calculatePagination(options);

    const { searchTerm, ...filterData } = filters ?? {};

    const andConditions: Prisma.PatientWhereInput[] = [];

    const normalizedSearchTerm =
        typeof searchTerm === "string" ? searchTerm.trim() : "";

    if (normalizedSearchTerm) {
        andConditions.push({
            OR: patientSearchableFields.map((field) => ({
                [field]: {
                    contains: normalizedSearchTerm,
                    mode: "insensitive",
                },
            })),
        });
    }

    // Default: hide deleted records unless explicitly requested
    if (typeof filterData?.isDeleted === "undefined") {
        andConditions.push({ isDeleted: false });
    }

    if (filterData && Object.keys(filterData).length > 0) {
        andConditions.push({
            AND: Object.entries(filterData).map(([field, value]) => ({
                [field]: {
                    equals: value,
                },
            })),
        });
    }

    const whereConditions: Prisma.PatientWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const data = await prisma.patient.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: "desc" },
        include: {
            user: {
                select: {
                    id: true,
                    role: true,
                    userStatus: true,
                    createdAt: true,
                },
            },
        },
    });

    const total = await prisma.patient.count({ where: whereConditions });

    return {
        meta: {
            page,
            limit,
            total,
        },
        data,
    };
};

const getByIdFromDB = async (user: IJwtPayload, id: string) => {
    if (!user?.role) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized");
    }

    const where: Prisma.PatientWhereInput = {
        id,
        isDeleted: false,
    };

    // PATIENT can only see their own record
    if (user.role === "PATIENT") {
        where.email = user.email;
    }

    const patient = await prisma.patient.findFirst({
        where,
        include: {
            user: {
                select: {
                    id: true,
                    role: true,
                    userStatus: true,
                    createdAt: true,
                },
            },
        },
    });

    if (!patient) {
        if (user.role === "PATIENT") {
            throw new AppError(httpStatus.FORBIDDEN, "Forbidden");
        }
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found");
    }

    return patient;
};

const updateIntoDB = async (user: IJwtPayload, id: string, payload: any) => {
    if (!user?.role) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized");
    }

    const existing = await prisma.patient.findFirst({
        where: {
            id,
            isDeleted: false,
        },
        select: { id: true, email: true },
    });

    if (!existing) {
        throw new AppError(httpStatus.NOT_FOUND, "Patient not found");
    }

    if (user.role === "PATIENT" && existing.email !== user.email) {
        throw new AppError(httpStatus.FORBIDDEN, "Forbidden");
    }

    // Avoid breaking User<->Patient relation by email
    const { email, id: _ignoredId, ...data } = payload ?? {};

    return await prisma.patient.update({
        where: { id },
        data,
    });
};

const deleteFromDB = async (id: string) => {
    const patient = await prisma.patient.findFirstOrThrow({
        where: {
            id,
            isDeleted: false,
        },
        select: {
            id: true,
            email: true,
        },
    });

    return await prisma.$transaction(async (tnx) => {
        const deletedPatient = await tnx.patient.update({
            where: { id: patient.id },
            data: { isDeleted: true },
        });

        await tnx.user.updateMany({
            where: { email: patient.email },
            data: { userStatus: UserStatus.DELETED },
        });

        return deletedPatient;
    });
};

export const patientService = {
    getAllFromDB,
    getByIdFromDB,
    updateIntoDB,
    deleteFromDB,
};
