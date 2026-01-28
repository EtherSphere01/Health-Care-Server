import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import pick from "../../helper/pick";
import { IOptions } from "../../helper/paginationHelper";
import { adminFilterableFields } from "./admin.constant";
import { adminService } from "./admin.service";

const getAllFromDB = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
    const filters = pick(req.query, adminFilterableFields);

    const result = await adminService.getAllFromDB(
        filters,
        options as IOptions,
    );

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Admins fetched successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getByIdFromDB = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await adminService.getByIdFromDB(id as string);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Admin fetched successfully",
        data: result,
    });
});

const updateIntoDB = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await adminService.updateIntoDB(id as string, req.body);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Admin updated successfully",
        data: result,
    });
});

const deleteFromDB = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await adminService.deleteFromDB(id as string);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Admin deleted successfully",
        data: result,
    });
});

export const adminController = {
    getAllFromDB,
    getByIdFromDB,
    updateIntoDB,
    deleteFromDB,
};
