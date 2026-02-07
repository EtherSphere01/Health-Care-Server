import {
    AppointmentStatus,
    NotificationType,
    PaymentStatus,
    Prisma,
    UserRole,
} from "@prisma/client";
import httpStatus from "http-status";
import { v4 as uuidv4 } from "uuid";
import { paginationHelper } from "../../../helpers/paginationHelper";
import { stripe } from "../../../helpers/stripe";
import prisma from "../../../shared/prisma";
import config from "../../../config";
import ApiError from "../../errors/ApiError";
import { IAuthUser } from "../../interfaces/common";
import { IPaginationOptions } from "../../interfaces/pagination";

function normalizeOrigin(raw: string | undefined): string | undefined {
    const value = raw?.trim();
    if (!value) return undefined;
    try {
        return new URL(value).origin;
    } catch {
        return value.replace(/\/+$/g, "");
    }
}

function getFrontendBaseUrl(requestOrigin?: string): string {
    return (
        normalizeOrigin(requestOrigin) ||
        config.frontendUrl ||
        "http://localhost:3000"
    );
}

const createAppointment = async (
    user: IAuthUser,
    payload: any,
    requestOrigin?: string,
) => {
    const frontendBaseUrl = getFrontendBaseUrl(requestOrigin);
    const patientData = await prisma.patient.findUniqueOrThrow({
        where: {
            email: user?.email,
        },
    });

    const doctorData = await prisma.doctor.findUniqueOrThrow({
        where: {
            id: payload.doctorId,
            isDeleted: false,
        },
    });

    await prisma.doctorSchedules.findFirstOrThrow({
        where: {
            doctorId: doctorData.id,
            scheduleId: payload.scheduleId,
            isBooked: false,
        },
    });

    const roomId = uuidv4();
    const videoCallingId = `https://meet.jit.si/${roomId}`;

    const result = await prisma.$transaction(async (tnx) => {
        const appointmentData = await tnx.appointment.create({
            data: {
                patientId: patientData.id,
                doctorId: doctorData.id,
                scheduleId: payload.scheduleId,
                videoCallingId,
            },
        });

        await tnx.notification.createMany({
            data: [
                {
                    recipientEmail: patientData.email,
                    recipientRole: UserRole.PATIENT,
                    type: NotificationType.APPOINTMENT_CREATED,
                    title: "Appointment booked",
                    message: `Your appointment with ${doctorData.name} has been booked.`,
                    link: "/dashboard/my-appointments",
                },
                {
                    recipientEmail: doctorData.email,
                    recipientRole: UserRole.DOCTOR,
                    type: NotificationType.APPOINTMENT_CREATED,
                    title: "New appointment",
                    message: `You have a new appointment with ${patientData.name}.`,
                    link: "/doctor/dashboard/appointments",
                },
            ],
        });

        await tnx.doctorSchedules.update({
            where: {
                doctorId_scheduleId: {
                    doctorId: doctorData.id,
                    scheduleId: payload.scheduleId,
                },
            },
            data: {
                isBooked: true,
            },
        });

        const transactionId = uuidv4();

        const paymentData = await tnx.payment.create({
            data: {
                appointmentId: appointmentData.id,
                amount: doctorData.appointmentFee,
                transactionId,
            },
        });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            customer_email: user?.email || "",
            line_items: [
                {
                    price_data: {
                        currency: "bdt",
                        product_data: {
                            name: `Appointment with ${doctorData.name}`,
                        },
                        unit_amount: doctorData.appointmentFee * 100,
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                appointmentId: appointmentData.id,
                paymentId: paymentData.id,
            },
            success_url: `${frontendBaseUrl}/dashboard/my-appointments?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendBaseUrl}/dashboard/my-appointments?payment=cancelled`,
        });

        return { paymentUrl: session.url };
    });

    return result;
};

const getMyAppointment = async (
    user: IAuthUser,
    filters: any,
    options: IPaginationOptions,
) => {
    const { page, limit, skip, sortBy, sortOrder } =
        paginationHelper.calculatePagination(options);
    const { ...filterData } = filters;

    const andConditions: Prisma.AppointmentWhereInput[] = [];

    if (user?.role === UserRole.PATIENT) {
        andConditions.push({
            patient: {
                email: user?.email,
            },
        });
    } else if (user?.role === UserRole.DOCTOR) {
        andConditions.push({
            doctor: {
                email: user?.email,
            },
        });
    }

    if (Object.keys(filterData).length > 0) {
        const filterConditions = Object.keys(filterData).map((key) => ({
            [key]: {
                equals: (filterData as any)[key],
            },
        }));

        andConditions.push(...filterConditions);
    }

    const whereConditions: Prisma.AppointmentWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.appointment.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: {
            [sortBy]: sortOrder,
        },
        include:
            user?.role === UserRole.DOCTOR
                ? {
                      patient: true,
                      schedule: true,
                      prescription: true,
                      review: true,
                      payment: true,
                      doctor: {
                          include: {
                              doctorSpecialties: {
                                  include: {
                                      specialities: true,
                                  },
                              },
                          },
                      },
                  }
                : {
                      doctor: {
                          include: {
                              doctorSpecialties: {
                                  include: {
                                      specialities: true,
                                  },
                              },
                          },
                      },
                      schedule: true,
                      prescription: true,
                      review: true,
                      payment: true,
                      patient: true,
                  },
    });

    const total = await prisma.appointment.count({
        where: whereConditions,
    });

    return {
        meta: {
            total,
            limit,
            page,
        },
        data: result,
    };
};

// task get all data from db (appointment data) - admin

const updateAppointmentStatus = async (
    appointmentId: string,
    status: AppointmentStatus,
    user: IAuthUser,
) => {
    const appointmentData = await prisma.appointment.findUniqueOrThrow({
        where: {
            id: appointmentId,
        },
        include: {
            doctor: true,
            patient: true,
        },
    });

    if (user?.role === UserRole.DOCTOR) {
        if (!(user?.email === appointmentData.doctor.email))
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                "This is not your appointment",
            );
    }

    const updated = await prisma.appointment.update({
        where: {
            id: appointmentId,
        },
        data: {
            status,
        },
    });

    await prisma.notification.createMany({
        data: [
            {
                recipientEmail: appointmentData.patient.email,
                recipientRole: UserRole.PATIENT,
                type: NotificationType.APPOINTMENT_STATUS_UPDATED,
                title: "Appointment updated",
                message: `Your appointment status is now ${status}.`,
                link: "/dashboard/my-appointments",
            },
            {
                recipientEmail: appointmentData.doctor.email,
                recipientRole: UserRole.DOCTOR,
                type: NotificationType.APPOINTMENT_STATUS_UPDATED,
                title: "Appointment updated",
                message: `Appointment status is now ${status}.`,
                link: "/doctor/dashboard/appointments",
            },
        ],
    });

    return updated;
};

const getAllFromDB = async (filters: any, options: IPaginationOptions) => {
    const { limit, page, skip } = paginationHelper.calculatePagination(options);
    const { patientEmail, doctorEmail, ...filterData } = filters;
    const andConditions = [];

    if (patientEmail) {
        andConditions.push({
            patient: {
                email: patientEmail,
            },
        });
    } else if (doctorEmail) {
        andConditions.push({
            doctor: {
                email: doctorEmail,
            },
        });
    }

    if (Object.keys(filterData).length > 0) {
        andConditions.push({
            AND: Object.keys(filterData).map((key) => {
                return {
                    [key]: {
                        equals: (filterData as any)[key],
                    },
                };
            }),
        });
    }

    // console.dir(andConditions, { depth: Infinity })
    const whereConditions: Prisma.AppointmentWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.appointment.findMany({
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
            doctor: {
                include: {
                    doctorSpecialties: {
                        include: {
                            specialities: true,
                        },
                    },
                },
            },
            patient: true,
            schedule: true,
            prescription: true,
            review: true,
            payment: true,
        },
    });
    const total = await prisma.appointment.count({
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

const cancelUnpaidAppointments = async () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    const unPaidAppointments = await prisma.appointment.findMany({
        where: {
            createdAt: {
                lte: thirtyMinAgo,
            },
            paymentStatus: PaymentStatus.UNPAID,
        },
    });

    const appointmentIdsToCancel = unPaidAppointments.map(
        (appointment) => appointment.id,
    );

    await prisma.$transaction(async (tnx) => {
        // Update appointments to CANCELED status instead of deleting
        await tnx.appointment.updateMany({
            where: {
                id: {
                    in: appointmentIdsToCancel,
                },
            },
            data: {
                status: AppointmentStatus.CANCELED,
            },
        });

        // Delete associated payments
        await tnx.payment.deleteMany({
            where: {
                appointmentId: {
                    in: appointmentIdsToCancel,
                },
            },
        });

        // Free up doctor schedules
        for (const unPaidAppointment of unPaidAppointments) {
            await tnx.doctorSchedules.update({
                where: {
                    doctorId_scheduleId: {
                        doctorId: unPaidAppointment.doctorId,
                        scheduleId: unPaidAppointment.scheduleId,
                    },
                },
                data: {
                    isBooked: false,
                },
            });
        }
    });
};

const createAppointmentWithPayLater = async (user: IAuthUser, payload: any) => {
    const patientData = await prisma.patient.findUniqueOrThrow({
        where: {
            email: user?.email,
        },
    });

    const doctorData = await prisma.doctor.findUniqueOrThrow({
        where: {
            id: payload.doctorId,
            isDeleted: false,
        },
    });

    await prisma.doctorSchedules.findFirstOrThrow({
        where: {
            doctorId: doctorData.id,
            scheduleId: payload.scheduleId,
            isBooked: false,
        },
    });

    const roomId = uuidv4();
    const videoCallingId = `https://meet.jit.si/${roomId}`;

    const result = await prisma.$transaction(async (tnx) => {
        const appointmentData = await tnx.appointment.create({
            data: {
                patientId: patientData.id,
                doctorId: doctorData.id,
                scheduleId: payload.scheduleId,
                videoCallingId,
            },
            include: {
                patient: true,
                doctor: true,
                schedule: true,
            },
        });

        await tnx.notification.createMany({
            data: [
                {
                    recipientEmail: patientData.email,
                    recipientRole: UserRole.PATIENT,
                    type: NotificationType.APPOINTMENT_CREATED,
                    title: "Appointment booked",
                    message: `Your appointment with ${doctorData.name} has been booked.`,
                    link: "/dashboard/my-appointments",
                },
                {
                    recipientEmail: doctorData.email,
                    recipientRole: UserRole.DOCTOR,
                    type: NotificationType.APPOINTMENT_CREATED,
                    title: "New appointment",
                    message: `You have a new appointment with ${patientData.name}.`,
                    link: "/doctor/dashboard/appointments",
                },
            ],
        });

        await tnx.doctorSchedules.update({
            where: {
                doctorId_scheduleId: {
                    doctorId: doctorData.id,
                    scheduleId: payload.scheduleId,
                },
            },
            data: {
                isBooked: true,
            },
        });

        const transactionId = uuidv4();

        await tnx.payment.create({
            data: {
                appointmentId: appointmentData.id,
                amount: doctorData.appointmentFee,
                transactionId,
            },
        });

        return appointmentData;
    });

    return result;
};

const initiatePaymentForAppointment = async (
    appointmentId: string,
    user: IAuthUser,
    requestOrigin?: string,
) => {
    const frontendBaseUrl = getFrontendBaseUrl(requestOrigin);
    const patientData = await prisma.patient.findUniqueOrThrow({
        where: {
            email: user?.email,
        },
    });

    const appointment = await prisma.appointment.findUnique({
        where: {
            id: appointmentId,
            patientId: patientData.id,
        },
        include: {
            payment: true,
            doctor: true,
        },
    });

    if (!appointment) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Appointment not found or unauthorized",
        );
    }

    if (appointment.paymentStatus !== PaymentStatus.UNPAID) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Payment already completed for this appointment",
        );
    }

    if (appointment.status === AppointmentStatus.CANCELED) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "Cannot pay for cancelled appointment",
        );
    }

    const amount = Number(appointment.payment?.amount ?? 0);
    const transactionId = String(appointment.payment?.transactionId ?? "");

    if (!appointment.payment || !transactionId) {
        throw new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            "Payment record not found for this appointment",
        );
    }

    // Stripe does not allow 0 amount checkouts. Treat 0 as a free appointment.
    if (amount <= 0) {
        await prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: { id: appointment.payment!.id },
                data: {
                    status: PaymentStatus.PAID,
                    paymentGatewayData: {
                        provider: "free",
                        amount,
                        markedPaidAt: new Date().toISOString(),
                    },
                },
            });

            await tx.appointment.update({
                where: { id: appointment.id },
                data: { paymentStatus: PaymentStatus.PAID },
            });
        });

        return {
            paymentUrl: `${frontendBaseUrl}/dashboard/my-appointments`,
            transactionId,
        };
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: user?.email || "",
        line_items: [
            {
                price_data: {
                    currency: "bdt",
                    product_data: {
                        name: `Appointment with ${appointment.doctor.name}`,
                    },
                    unit_amount: amount * 100,
                },
                quantity: 1,
            },
        ],
        metadata: {
            appointmentId: appointment.id,
            paymentId: appointment.payment!.id,
        },
        success_url: `${frontendBaseUrl}/dashboard/my-appointments?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendBaseUrl}/dashboard/my-appointments?payment=cancelled`,
    });

    return { paymentUrl: session.url, transactionId };
};

export const AppointmentService = {
    createAppointment,
    getMyAppointment,
    updateAppointmentStatus,
    getAllFromDB,
    cancelUnpaidAppointments,
    createAppointmentWithPayLater,
    initiatePaymentForAppointment,
};
