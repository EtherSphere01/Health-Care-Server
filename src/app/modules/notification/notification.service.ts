import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import ApiError from "../../errors/ApiError";
import { IAuthUser } from "../../interfaces/common";
import { IPaginationOptions } from "../../interfaces/pagination";
import { paginationHelper } from "../../../helpers/paginationHelper";

const getMyNotifications = async (
    user: IAuthUser,
    options: IPaginationOptions,
) => {
    if (!user?.email) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
    }

    const { page, limit, skip, sortBy, sortOrder } =
        paginationHelper.calculatePagination(options);

    const where = {
        recipientEmail: user.email,
    };

    const data = await prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
            [sortBy]: sortOrder,
        },
    });

    const total = await prisma.notification.count({ where });
    const unreadCount = await prisma.notification.count({
        where: { ...where, isRead: false },
    });

    return {
        meta: {
            total,
            page,
            limit,
            unreadCount,
        },
        data,
    };
};

const markAsRead = async (user: IAuthUser, id: string) => {
    if (!user?.email) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
    }

    const notification = await prisma.notification.findUnique({
        where: { id },
        select: { id: true, recipientEmail: true },
    });

    if (!notification) {
        throw new ApiError(httpStatus.NOT_FOUND, "Notification not found");
    }

    if (notification.recipientEmail !== user.email) {
        throw new ApiError(httpStatus.FORBIDDEN, "Not authorized");
    }

    return prisma.notification.update({
        where: { id },
        data: { isRead: true },
    });
};

const markAllAsRead = async (user: IAuthUser) => {
    if (!user?.email) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
    }

    await prisma.notification.updateMany({
        where: { recipientEmail: user.email, isRead: false },
        data: { isRead: true },
    });

    return { success: true };
};

export const notificationService = {
    getMyNotifications,
    markAsRead,
    markAllAsRead,
};
