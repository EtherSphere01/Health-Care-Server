import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";
import pick from "../../../shared/pick";
import { notificationService } from "./notification.service";
import { IAuthUser } from "../../interfaces/common";

const getMyNotifications = catchAsync(
    async (req: Request & { user?: IAuthUser }, res: Response) => {
        const user = req.user as IAuthUser;
        const options = pick(req.query, [
            "limit",
            "page",
            "sortBy",
            "sortOrder",
        ]);

        const result = await notificationService.getMyNotifications(
            user,
            options,
        );

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Notifications fetched",
            meta: result.meta,
            data: result.data,
        });
    },
);

const markAsRead = catchAsync(
    async (req: Request & { user?: IAuthUser }, res: Response) => {
        const user = req.user as IAuthUser;
        const rawId = (req.params as any).id;
        const id = Array.isArray(rawId) ? rawId[0] : String(rawId);

        const result = await notificationService.markAsRead(user, id);

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Notification marked as read",
            data: result,
        });
    },
);

const markAllAsRead = catchAsync(
    async (req: Request & { user?: IAuthUser }, res: Response) => {
        const user = req.user as IAuthUser;

        const result = await notificationService.markAllAsRead(user);

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "All notifications marked as read",
            data: result,
        });
    },
);

export const notificationController = {
    getMyNotifications,
    markAsRead,
    markAllAsRead,
};
