import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { doctorScheduleService } from "./doctorSchedule.service";
import sendResponse from "../../shared/sendResponse";
import { IJwtPayload } from "../../types/common";
import pick from "../../helper/pick";

const insertIntoDB = catchAsync(
    async (req: Request & { user?: IJwtPayload }, res: Response) => {
        const user = req.user;

        const result = await doctorScheduleService.insertIntoDB(
            user as IJwtPayload,
            req.body,
        );
        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: "Doctor schedule inserted successfully",
            data: result,
        });
    },
);

const schedulesForDoctor = catchAsync(
    async (req: Request & { user?: IJwtPayload }, res: Response) => {
        const user = req.user;

        const options = pick(req.query, [
            "page",
            "limit",
            "sortBy",
            "sortOrder",
        ]);
        const filters = pick(req.query, [
            "isBooked",
            "scheduleId",
            "startDateTime",
            "endDateTime",
            "filterStartDateTime",
            "filterEndDateTime",
        ]);

        const result = await doctorScheduleService.schedulesForDoctor(
            user as IJwtPayload,
            filters,
            options,
        );

        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: "Doctor schedules fetched successfully",
            meta: result.meta,
            data: result.data,
        });
    },
);

const deleteDoctorScheduleFromDB = catchAsync(
    async (req: Request & { user?: IJwtPayload }, res: Response) => {
        const user = req.user;
        const result = await doctorScheduleService.deleteDoctorScheduleFromDB(
            user as IJwtPayload,
            req.params.scheduleId as string,
        );

        sendResponse(res, {
            statusCode: 200,
            success: true,
            message: "Doctor schedule deleted successfully",
            data: result,
        });
    },
);

export const doctorScheduleController = {
    insertIntoDB,
    schedulesForDoctor,
    deleteDoctorScheduleFromDB,
};
