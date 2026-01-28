import { Doctor, Prisma } from "@prisma/client";
import { IOptions, paginationHelper } from "../../helper/paginationHelper";
import { doctorSearchableFields } from "./doctor.constant";
import { prisma } from "../../shared/prisma";
import { IDoctorUpdateInput } from "./doctor.interface";
import { UserStatus } from "@prisma/client";
import { IJwtPayload } from "../../types/common";
import httpStatus from "http-status";
import AppError from "../../errors/AppError";

const getAllFromDB = async (filters: any, options: IOptions) => {
    const { page, limit, skip, sortBy, sortOrder } =
        paginationHelper.calculatePagination(options);
    const { searchTerm, specialties, ...filterData } = filters;

    const andConditions: Prisma.DoctorWhereInput[] = [];

    if (searchTerm) {
        andConditions.push({
            OR: doctorSearchableFields.map((field) => ({
                [field]: {
                    contains: searchTerm,
                    mode: "insensitive",
                },
            })),
        });
    }

    if (specialties && specialties.length > 0) {
        andConditions.push({
            doctorSpecialties: {
                some: {
                    specialties: {
                        title: {
                            contains: specialties,
                            mode: "insensitive",
                        },
                    },
                },
            },
        });
    }

    if (Object.keys(filterData).length) {
        const filterConditions = Object.keys(filterData).map((key) => ({
            [key]: {
                equals: filterData[key],
            },
        }));

        andConditions.push(...filterConditions);
    }

    const whereConditions: Prisma.DoctorWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};
    const result = await prisma.doctor.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: "desc" },
        include: {
            doctorSpecialties: {
                include: {
                    specialties: true,
                },
            },
        },
    });

    const total = await prisma.doctor.count({
        where: whereConditions,
    });

    return {
        meta: {
            page,
            limit,
            total,
        },
        data: result,
    };
};

const updateIntoDB = async (
    user: IJwtPayload,
    id: string,
    payload: Partial<IDoctorUpdateInput>,
) => {
    if (!user?.role) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized");
    }

    const doctorInfo = await prisma.doctor.findFirst({
        where: { id, isDeleted: false },
        select: { id: true, email: true },
    });

    if (!doctorInfo) {
        throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
    }

    if (user.role === "DOCTOR" && doctorInfo.email !== user.email) {
        throw new AppError(httpStatus.FORBIDDEN, "Forbidden");
    }

    const { specialties, ...doctorData } = payload;

    return await prisma.$transaction(async (tnx) => {
        if (specialties && specialties.length > 0) {
            const deleteSpecialtyIds = specialties.filter(
                (spec) => spec.isDeleted,
            );

            const createSpecialtyIds = specialties.filter(
                (spec) => !spec.isDeleted,
            );

            for (const specialty of deleteSpecialtyIds) {
                await tnx.doctorSpecialties.deleteMany({
                    where: {
                        doctorId: id,
                        specialtiesId: specialty.specialtyId,
                    },
                });
            }

            for (const specialty of createSpecialtyIds) {
                await tnx.doctorSpecialties.create({
                    data: {
                        doctorId: id,
                        specialtiesId: specialty.specialtyId,
                    },
                });
            }
        }

        const updatedData = await tnx.doctor.update({
            where: {
                id: doctorInfo.id,
            },
            data: doctorData,
            include: {
                doctorSpecialties: {
                    include: {
                        specialties: true,
                    },
                },
            },
        });
        return updatedData;
    });
};

const getByIdFromDB = async (user: IJwtPayload, id: string) => {
    if (!user?.role) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized");
    }

    const where: Prisma.DoctorWhereInput = {
        id,
        isDeleted: false,
    };

    if (user.role === "DOCTOR") {
        where.email = user.email;
    }

    const doctor = await prisma.doctor.findFirst({
        where,
        include: {
            doctorSpecialties: {
                include: {
                    specialties: true,
                },
            },
        },
    });

    if (!doctor) {
        if (user.role === "DOCTOR") {
            throw new AppError(httpStatus.FORBIDDEN, "Forbidden");
        }
        throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
    }

    return doctor;
};

const deleteFromDB = async (id: string) => {
    const doctor = await prisma.doctor.findFirstOrThrow({
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
        const deletedDoctor = await tnx.doctor.update({
            where: { id: doctor.id },
            data: {
                isDeleted: true,
            },
        });

        await tnx.user.updateMany({
            where: {
                email: doctor.email,
            },
            data: {
                userStatus: UserStatus.DELETED,
            },
        });

        return deletedDoctor;
    });
};

export const doctorService = {
    getAllFromDB,
    updateIntoDB,
    getByIdFromDB,
    deleteFromDB,
};
