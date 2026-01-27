import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { scheduleService } from "./schedule.service";
import pick from "../../helper/pick";

const schedulesForDoctor = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
    const filters = pick(req.query, [
        "startDateTime",
        "endDateTime",
        "filterStartDateTime",
        "filterEndDateTime",
    ]);
    const result = await scheduleService.schedulesForDoctor(filters, options);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Schedule fetched successfully",
        meta: result.meta,
        data: result.data,
    });
});

const insertIntoDB = catchAsync(async (req: Request, res: Response) => {
    const result = await scheduleService.insertIntoDB(req.body);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Schedule inserted successfully",
        data: result,
    });
});

export const scheduleController = {
    insertIntoDB,
    schedulesForDoctor,
};
