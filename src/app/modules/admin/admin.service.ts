import { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { IOptions, paginationHelper } from "../../helper/paginationHelper";
import { adminSearchableFields } from "./admin.constant";

const getAllFromDB = async (filters: any, options: IOptions) => {
    const { page, limit, skip, sortBy, sortOrder } =
        paginationHelper.calculatePagination(options);

    const { searchTerm, ...filterData } = filters ?? {};

    const andConditions: Prisma.AdminWhereInput[] = [];

    const normalizedSearchTerm =
        typeof searchTerm === "string" ? searchTerm.trim() : "";

    if (normalizedSearchTerm) {
        andConditions.push({
            OR: adminSearchableFields.map((field) => ({
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

    const whereConditions: Prisma.AdminWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const data = await prisma.admin.findMany({
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

    const total = await prisma.admin.count({ where: whereConditions });

    return {
        meta: {
            page,
            limit,
            total,
        },
        data,
    };
};

const getByIdFromDB = async (id: string) => {
    return await prisma.admin.findFirstOrThrow({
        where: {
            id,
            isDeleted: false,
        },
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
};

const updateIntoDB = async (id: string, payload: any) => {
    await prisma.admin.findFirstOrThrow({
        where: {
            id,
            isDeleted: false,
        },
        select: { id: true },
    });

    // Avoid breaking User<->Admin relation by email
    const { email, id: _ignoredId, ...data } = payload ?? {};

    return await prisma.admin.update({
        where: { id },
        data,
    });
};

const deleteFromDB = async (id: string) => {
    const admin = await prisma.admin.findFirstOrThrow({
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
        const deletedAdmin = await tnx.admin.update({
            where: { id: admin.id },
            data: { isDeleted: true },
        });

        await tnx.user.updateMany({
            where: { email: admin.email },
            data: { userStatus: UserStatus.DELETED },
        });

        return deletedAdmin;
    });
};

export const adminService = {
    getAllFromDB,
    getByIdFromDB,
    updateIntoDB,
    deleteFromDB,
};
