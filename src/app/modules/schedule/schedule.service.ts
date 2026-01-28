import { addHours, addMinutes, format } from "date-fns";
import { prisma } from "../../shared/prisma";
import { paginationHelper } from "../../helper/paginationHelper";
import { Prisma } from "@prisma/client";
import { IJwtPayload } from "../../types/common";

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

const schedulesForDoctor = async (
    user: IJwtPayload,
    filters: any,
    options: any,
) => {
    const { page, limit, skip, sortBy, sortOrder } =
        paginationHelper.calculatePagination(options);

    const startRaw = filters?.startDateTime ?? filters?.filterStartDateTime;
    const endRaw = filters?.endDateTime ?? filters?.filterEndDateTime;

    const startDateTime = toValidDateOrUndefined(startRaw);
    const endDateTime = toValidDateOrUndefined(endRaw);

    const andConditions: Prisma.ScheduleWhereInput[] = [];

    if (startDateTime) {
        andConditions.push({ startDateTime: { gte: startDateTime } });
    }

    if (endDateTime) {
        andConditions.push({ endDateTime: { lte: endDateTime } });
    }

    const whereConditions: Prisma.ScheduleWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const doctorSchedules = await prisma.doctorSchedules.findMany({
        where: {
            doctor: {
                email: user.email,
                isDeleted: false,
            },
        },
        select: {
            scheduleId: true,
        },
    });
    const doctorScheduleIds = doctorSchedules.map((ds) => ds.scheduleId);

    const result = await prisma.schedule.findMany({
        where: {
            ...whereConditions,
            id: {
                notIn: doctorScheduleIds,
            },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: skip,
        take: limit,
    });
    const total = await prisma.schedule.count({
        where: {
            ...whereConditions,
            id: {
                notIn: doctorScheduleIds,
            },
        },
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

const insertIntoDB = async (payload: any) => {
    const { startTime, endTime, startDate, endDate } = payload;

    const intervalTime = 30;

    const currentDate = new Date(startDate);
    const lastDate = new Date(endDate);
    const schedules: any = [];

    while (currentDate <= lastDate) {
        const startDateTime = new Date(
            addMinutes(
                addHours(
                    `${format(currentDate, "yyyy-MM-dd")}`,
                    Number(startTime.split(":")[0]),
                ),
                Number(startTime.split(":")[1]),
            ),
        );
        const endDateTime = new Date(
            addMinutes(
                addHours(
                    `${format(currentDate, "yyyy-MM-dd")}`,
                    Number(endTime.split(":")[0]),
                ),
                Number(endTime.split(":")[1]),
            ),
        );

        while (startDateTime < endDateTime) {
            const slotStartDateTime = startDateTime;
            const slotEndDateTime = new Date(
                addMinutes(slotStartDateTime, intervalTime),
            );

            const scheduleData = {
                startDateTime: slotStartDateTime,
                endDateTime: slotEndDateTime,
            };
            const existingSchedule = await prisma.schedule.findFirst({
                where: scheduleData,
            });

            if (!existingSchedule) {
                await prisma.schedule.create({
                    data: scheduleData,
                });

                schedules.push(scheduleData);
            }
            startDateTime.setMinutes(startDateTime.getMinutes() + intervalTime);
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return schedules;
};

const deleteScheduleFromDB = async (id: string) => {
    return await prisma.schedule.delete({
        where: { id },
    });
};

export const scheduleService = {
    insertIntoDB,
    schedulesForDoctor,
    deleteScheduleFromDB,
};
