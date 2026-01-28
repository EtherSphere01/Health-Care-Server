import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import pick from "../../helper/pick";
import sendResponse from "../../shared/sendResponse";
import { doctorService } from "./doctor.service";
import { IOptions } from "../../helper/paginationHelper";
import { doctorFilterableFields } from "./doctor.constant";
import { IJwtPayload } from "../../types/common";

const getAllFromDB = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
    const filters = pick(req.query, doctorFilterableFields);

    const result = await doctorService.getAllFromDB(
        filters,
        options as IOptions,
    );

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Doctors fetched successfully",
        meta: result.meta,
        data: result.data,
    });
});

const updateIntoDB = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as Request & { user?: IJwtPayload }).user;
    const result = await doctorService.updateIntoDB(
        user as IJwtPayload,
        id as string,
        req.body,
    );

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Doctor updated successfully",
        data: result,
    });
});

const getByIdFromDB = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as Request & { user?: IJwtPayload }).user;
    const result = await doctorService.getByIdFromDB(
        user as IJwtPayload,
        id as string,
    );

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Doctor fetched successfully",
        data: result,
    });
});

const deleteFromDB = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await doctorService.deleteFromDB(id as string);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Doctor deleted successfully",
        data: result,
    });
});

const getAISuggestions = catchAsync(async (req: Request, res: Response) => {
    const result = await doctorService.getAISuggestions(req.body);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "AI suggestions fetched successfully",
        data: result,
    });
});

export const doctorController = {
    getAllFromDB,
    updateIntoDB,
    getByIdFromDB,
    deleteFromDB,
    getAISuggestions,
};
