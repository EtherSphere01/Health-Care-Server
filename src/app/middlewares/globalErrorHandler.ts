import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";

const globalErrorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    let statusCode: number = err.statusCode
        ? err.statusCode
        : httpStatus.INTERNAL_SERVER_ERROR;
    let success = false;
    let message = err.message || "Something went wrong!";
    let error = err;

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        const prismaCode = err.code;

        switch (prismaCode) {
            case "P2002":
                statusCode = httpStatus.CONFLICT;
                message = `Already exists: ${String(err.meta?.target ?? "unique field")}`;
                break;
            case "P2003":
                statusCode = httpStatus.CONFLICT;
                message =
                    "Cannot complete the operation because a related record does not exist";
                break;
            case "P2025":
                statusCode = httpStatus.NOT_FOUND;
                message = "Record not found";
                break;
            case "P2001":
                statusCode = httpStatus.NOT_FOUND;
                message = "Record not found";
                break;
            case "P2014":
                statusCode = httpStatus.CONFLICT;
                message = "The change would violate a required relation";
                break;
            case "P2011":
                statusCode = httpStatus.BAD_REQUEST;
                message = "A required field is missing";
                break;
            case "P2000":
                statusCode = httpStatus.BAD_REQUEST;
                message = "Input value is too long for this field";
                break;
            default:
                statusCode = httpStatus.BAD_REQUEST;
                message = "Database request failed";
                break;
        }

        error = {
            prismaCode,
            meta: err.meta,
        };
    } else if (err instanceof Prisma.PrismaClientValidationError) {
        statusCode = httpStatus.BAD_REQUEST;
        message = "Invalid database query";
        error = {
            name: err.name,
        };
    } else if (err instanceof ZodError) {
        statusCode = httpStatus.BAD_REQUEST;
        message = "Validation error";
        error = {
            issues: err.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        };
    }

    res.status(statusCode).json({
        success,
        message,
        error,
    });
};

export default globalErrorHandler;
