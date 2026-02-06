import {
    NotificationType,
    PaymentStatus,
    Prisma,
    UserRole,
} from "@prisma/client";
import httpStatus from "http-status";
import { paginationHelper } from "../../../helpers/paginationHelper";
import prisma from "../../../shared/prisma";
import ApiError from "../../errors/ApiError";
import { IAuthUser } from "../../interfaces/common";
import { IPaginationOptions } from "../../interfaces/pagination";

const insertIntoDB = async (user: IAuthUser, payload: any) => {
    const patientData = await prisma.patient.findUniqueOrThrow({
        where: {
            email: user?.email,
        },
    });

    const appointmentData = await prisma.appointment.findUniqueOrThrow({
        where: {
            id: payload.appointmentId,
        },
    });

    const doctorData = await prisma.doctor.findUniqueOrThrow({
        where: {
            id: appointmentData.doctorId,
        },
        select: {
            email: true,
            name: true,
        },
    });

    if (appointmentData.paymentStatus !== PaymentStatus.PAID) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Payment must be completed before submitting a review",
        );
    }

    if (!(patientData.id === appointmentData.patientId)) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "This is not your appointment!",
        );
    }

    return await prisma.$transaction(async (tx) => {
        const result = await tx.review.create({
            data: {
                appointmentId: appointmentData.id,
                doctorId: appointmentData.doctorId,
                patientId: appointmentData.patientId,
                rating: payload.rating,
                comment: payload.comment,
            },
        });

        await tx.notification.create({
            data: {
                recipientEmail: doctorData.email,
                recipientRole: UserRole.DOCTOR,
                type: NotificationType.REVIEW_CREATED,
                title: "New review received",
                message: `${patientData.name} left you a ${payload.rating}/5 review.`,
                link: "/doctor/dashboard",
            },
        });

        const averageRating = await tx.review.aggregate({
            _avg: {
                rating: true,
            },
        });

        await tx.doctor.update({
            where: {
                id: result.doctorId,
            },
            data: {
                averageRating: averageRating._avg.rating as number,
            },
        });

        return result;
    });
};

const getAllFromDB = async (filters: any, options: IPaginationOptions) => {
    const { limit, page, skip } = paginationHelper.calculatePagination(options);
    const { patientEmail, doctorEmail } = filters;
    const andConditions = [];

    if (patientEmail) {
        andConditions.push({
            patient: {
                email: patientEmail,
            },
        });
    }

    if (doctorEmail) {
        andConditions.push({
            doctor: {
                email: doctorEmail,
            },
        });
    }

    const whereConditions: Prisma.ReviewWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.review.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy:
            options.sortBy && options.sortOrder
                ? { [options.sortBy]: options.sortOrder }
                : {
                      createdAt: "desc",
                  },
        include: {
            doctor: true,
            patient: true,
            appointment: true,
        },
    });
    const total = await prisma.review.count({
        where: whereConditions,
    });

    return {
        meta: {
            total,
            page,
            limit,
        },
        data: result,
    };
};

export const ReviewService = {
    insertIntoDB,
    getAllFromDB,
};
