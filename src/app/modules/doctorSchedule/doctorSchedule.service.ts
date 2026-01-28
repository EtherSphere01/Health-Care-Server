import { prisma } from "../../shared/prisma";
import { IJwtPayload } from "../../types/common";
import { paginationHelper } from "../../helper/paginationHelper";
import { Prisma } from "@prisma/client";

const toValidDateOrUndefined = (value: unknown): Date | undefined => {
    if (!value) return undefined;
    if (value instanceof Date)
        return Number.isNaN(value.getTime()) ? undefined : value;
    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    return undefined;
};

const toBooleanOrUndefined = (value: unknown): boolean | undefined => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
    }
    return undefined;
};

const insertIntoDB = async (
    user: IJwtPayload,
    payload: {
        scheduleIds: string[];
    },
) => {
    if (!payload?.scheduleIds?.length) {
        throw new Error("scheduleIds is required");
    }

    if (!user?.email) {
        throw new Error("Unauthorized: missing user email");
    }

    const doctor = await prisma.doctor.findFirst({
        where: {
            email: user.email,
            isDeleted: false,
        },
        select: {
            id: true,
        },
    });

    if (!doctor) {
        throw new Error("Doctor profile not found for this account");
    }

    const schedules = await prisma.schedule.findMany({
        where: {
            id: {
                in: payload.scheduleIds,
            },
        },
        select: {
            id: true,
        },
    });

    if (schedules.length !== payload.scheduleIds.length) {
        throw new Error("One or more scheduleIds are invalid");
    }

    const doctorScheduleData = payload.scheduleIds.map((scheduleId) => ({
        doctorId: doctor.id,
        scheduleId,
    }));

    return await prisma.doctorSchedules.createMany({
        data: doctorScheduleData,
        skipDuplicates: true,
    });
};

// doctor schedule show
const schedulesForDoctor = async (
    user: IJwtPayload,
    filters: any,
    options: any,
) => {
    const { page, limit, skip, sortBy, sortOrder } =
        paginationHelper.calculatePagination(options);

    if (!user?.email) {
        throw new Error("Unauthorized: missing user email");
    }

    const startDateTime = toValidDateOrUndefined(
        filters?.startDateTime ?? filters?.filterStartDateTime,
    );
    const endDateTime = toValidDateOrUndefined(
        filters?.endDateTime ?? filters?.filterEndDateTime,
    );
    const isBooked = toBooleanOrUndefined(filters?.isBooked);
    const scheduleId =
        typeof filters?.scheduleId === "string"
            ? filters.scheduleId
            : undefined;

    const andConditions: Prisma.DoctorSchedulesWhereInput[] = [];

    if (typeof isBooked === "boolean") {
        andConditions.push({ isBooked });
    }

    if (scheduleId) {
        andConditions.push({ scheduleId });
    }

    if (startDateTime) {
        andConditions.push({
            schedule: { startDateTime: { gte: startDateTime } },
        });
    }

    if (endDateTime) {
        andConditions.push({ schedule: { endDateTime: { lte: endDateTime } } });
    }

    const whereConditions: Prisma.DoctorSchedulesWhereInput = {
        doctor: {
            email: user.email,
            isDeleted: false,
        },
        ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const orderBy: Prisma.DoctorSchedulesOrderByWithRelationInput =
        sortBy === "startDateTime"
            ? { schedule: { startDateTime: sortOrder } }
            : sortBy === "endDateTime"
              ? { schedule: { endDateTime: sortOrder } }
              : sortBy === "isBooked"
                ? { isBooked: sortOrder }
                : sortBy === "updatedAt"
                  ? { updatedAt: sortOrder }
                  : { createdAt: sortOrder };

    const data = await prisma.doctorSchedules.findMany({
        where: whereConditions,
        orderBy,
        skip,
        take: limit,
        select: {
            doctorId: true,
            scheduleId: true,
            isBooked: true,
            createdAt: true,
            updatedAt: true,
            schedule: {
                select: {
                    id: true,
                    startDateTime: true,
                    endDateTime: true,
                },
            },
        },
    });

    const total = await prisma.doctorSchedules.count({
        where: whereConditions,
    });

    return {
        meta: {
            page,
            limit,
            total,
        },
        data,
    };
};

// doctor schedule delete
const deleteDoctorScheduleFromDB = async (
    user: IJwtPayload,
    scheduleId: string,
) => {
    if (!user?.email) {
        throw new Error("Unauthorized: missing user email");
    }
    if (!scheduleId) {
        throw new Error("scheduleId is required");
    }

    const doctor = await prisma.doctor.findFirst({
        where: {
            email: user.email,
            isDeleted: false,
        },
        select: {
            id: true,
        },
    });

    if (!doctor) {
        throw new Error("Doctor profile not found for this account");
    }

    const result = await prisma.doctorSchedules.deleteMany({
        where: {
            doctorId: doctor.id,
            scheduleId,
        },
    });

    if (result.count === 0) {
        throw new Error("Doctor schedule not found");
    }

    return result;
};

export const doctorScheduleService = {
    insertIntoDB,
    schedulesForDoctor,
    deleteDoctorScheduleFromDB,
};
