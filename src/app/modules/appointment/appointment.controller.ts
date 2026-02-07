import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync";
import pick from "../../../shared/pick";
import sendResponse from "../../../shared/sendResponse";
import { IAuthUser } from "../../interfaces/common";
import { appointmentFilterableFields } from "./appointment.constant";
import { AppointmentService } from "./appointment.service";

function getRequestOrigin(req: Request): string | undefined {
    const explicit = req.headers["x-frontend-origin"];
    if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
    if (Array.isArray(explicit) && explicit[0]?.trim())
        return explicit[0].trim();

    const origin = req.headers.origin;
    if (typeof origin === "string" && origin.trim()) return origin.trim();

    const referer = req.headers.referer;
    if (typeof referer === "string" && referer.trim()) {
        try {
            return new URL(referer).origin;
        } catch {
            return undefined;
        }
    }

    return undefined;
}

const createAppointment = catchAsync(
    async (req: Request & { user?: IAuthUser }, res: Response) => {
        const user = req.user;

        const origin = getRequestOrigin(req);

        const result = await AppointmentService.createAppointment(
            user as IAuthUser,
            req.body,
            origin,
        );

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Appointment booked successfully!",
            data: result,
        });
    },
);

const getMyAppointment = catchAsync(
    async (req: Request & { user?: IAuthUser }, res: Response) => {
        const user = req.user;
        const filters = pick(req.query, ["status", "paymentStatus"]);
        const options = pick(req.query, [
            "limit",
            "page",
            "sortBy",
            "sortOrder",
        ]);

        const result = await AppointmentService.getMyAppointment(
            user as IAuthUser,
            filters,
            options,
        );

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "My Appointment retrive successfully",
            data: result.data,
            meta: result.meta,
        });
    },
);

const getAllFromDB = catchAsync(async (req: Request, res: Response) => {
    const filters = pick(req.query, appointmentFilterableFields);
    const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
    const result = await AppointmentService.getAllFromDB(filters, options);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Appointment retrieval successfully",
        meta: result.meta,
        data: result.data,
    });
});

const changeAppointmentStatus = catchAsync(
    async (req: Request & { user?: IAuthUser }, res: Response) => {
        const id = String(req.params.id);
        const { status } = req.body;
        const user = req.user;

        const result = await AppointmentService.updateAppointmentStatus(
            id,
            status,
            user as IAuthUser,
        );
        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Appointment status changed successfully",
            data: result,
        });
    },
);

const createAppointmentWithPayLater = catchAsync(
    async (req: Request & { user?: IAuthUser }, res: Response) => {
        const user = req.user;

        const result = await AppointmentService.createAppointmentWithPayLater(
            user as IAuthUser,
            req.body,
        );

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Appointment booked successfully! You can pay later.",
            data: result,
        });
    },
);

const initiatePayment = catchAsync(
    async (req: Request & { user?: IAuthUser }, res: Response) => {
        const user = req.user;
        const id = String(req.params.id);

        const origin = getRequestOrigin(req);

        const result = await AppointmentService.initiatePaymentForAppointment(
            id,
            user as IAuthUser,
            origin,
        );

        sendResponse(res, {
            statusCode: httpStatus.OK,
            success: true,
            message: "Payment session created successfully",
            data: result,
        });
    },
);

export const AppointmentController = {
    createAppointment,
    getMyAppointment,
    getAllFromDB,
    changeAppointmentStatus,
    createAppointmentWithPayLater,
    initiatePayment,
};
