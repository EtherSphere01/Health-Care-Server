import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import pick from "../../helpers/pick";
import { IOptions } from "../../helpers/paginationHelper";
import { patientFilterableFields } from "./patient.constant";
import { patientService } from "./patient.service";
import { IJwtPayload } from "../../types/common";

const getAllFromDB = catchAsync(async (req: Request, res: Response) => {
    const options = pick(req.query, ["page", "limit", "sortBy", "sortOrder"]);
    const filters = pick(req.query, patientFilterableFields);

    const result = await patientService.getAllFromDB(
        filters,
        options as IOptions,
    );

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Patients fetched successfully",
        meta: result.meta,
        data: result.data,
    });
});

const getByIdFromDB = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as Request & { user?: IJwtPayload }).user;
    const result = await patientService.getByIdFromDB(
        user as IJwtPayload,
        id as string,
    );

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Patient fetched successfully",
        data: result,
    });
});

const updateIntoDB = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as Request & { user?: IJwtPayload }).user;
    const result = await patientService.updateIntoDB(
        user as IJwtPayload,
        id as string,
        req.body,
    );

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Patient updated successfully",
        data: result,
    });
});

const deleteFromDB = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await patientService.deleteFromDB(id as string);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: "Patient deleted successfully",
        data: result,
    });
});

export const patientController = {
    getAllFromDB,
    getByIdFromDB,
    updateIntoDB,
    deleteFromDB,
};
