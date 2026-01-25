import catchAsync from "../../shared/catchAsync";
import { Request, Response } from "express";
import { userService } from "./user.service";

const createPatient = catchAsync(async (req: Request, res: Response) => {
    const result = await userService.createPatient(req.body);
});

export const userController = {
    createPatient,
};
