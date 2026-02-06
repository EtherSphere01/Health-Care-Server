import { PaymentStatus } from "@prisma/client";
import httpStatus from "http-status";
import Stripe from "stripe";
import prisma from "../../../shared/prisma";
import ApiError from "../../errors/ApiError";
import { stripe } from "../../../helpers/stripe";

const handleStripeWebhookEvent = async (event: Stripe.Event) => {
    // Check if event has already been processed (idempotency)
    const existingPayment = await prisma.payment.findFirst({
        where: {
            stripeEventId: event.id,
        },
    });

    if (existingPayment) {
        console.log(`⚠️ Event ${event.id} already processed. Skipping.`);
        return { message: "Event already processed" };
    }

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object as any;

            const appointmentId = session.metadata?.appointmentId;
            const paymentId = session.metadata?.paymentId;

            if (!appointmentId || !paymentId) {
                console.error("⚠️ Missing metadata in webhook event");
                return { message: "Missing metadata" };
            }

            // Verify appointment exists
            const appointment = await prisma.appointment.findUnique({
                where: { id: appointmentId },
            });

            if (!appointment) {
                console.error(
                    `⚠️ Appointment ${appointmentId} not found. Payment may be for expired appointment.`,
                );
                return { message: "Appointment not found" };
            }

            // Update both appointment and payment in a transaction
            await prisma.$transaction(async (tx) => {
                await tx.appointment.update({
                    where: {
                        id: appointmentId,
                    },
                    data: {
                        paymentStatus:
                            session.payment_status === "paid"
                                ? PaymentStatus.PAID
                                : PaymentStatus.UNPAID,
                    },
                });

                await tx.payment.update({
                    where: {
                        id: paymentId,
                    },
                    data: {
                        status:
                            session.payment_status === "paid"
                                ? PaymentStatus.PAID
                                : PaymentStatus.UNPAID,
                        paymentGatewayData: session,
                        stripeEventId: event.id, // Store event ID for idempotency
                    },
                });
            });

            console.log(
                `✅ Payment ${session.payment_status} for appointment ${appointmentId}`,
            );
            break;
        }

        case "checkout.session.expired": {
            const session = event.data.object as any;
            console.log(`⚠️ Checkout session expired: ${session.id}`);
            // Appointment will be cleaned up by cron job
            break;
        }

        case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object as any;
            console.log(`❌ Payment failed: ${paymentIntent.id}`);
            break;
        }

        default:
            console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return { message: "Webhook processed successfully" };
};

export const PaymentService = {
    handleStripeWebhookEvent,
    validateIpnCallback: async (transactionId: string, status: string) => {
        const payment = await prisma.payment.findUnique({
            where: { transactionId },
            include: { appointment: true },
        });

        if (!payment) {
            throw new ApiError(httpStatus.NOT_FOUND, "Payment not found");
        }

        const normalizedStatus = String(status ?? "").toLowerCase();
        const isSuccess =
            normalizedStatus === "success" || normalizedStatus === "paid";

        await prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: { id: payment.id },
                data: {
                    status: isSuccess
                        ? PaymentStatus.PAID
                        : PaymentStatus.UNPAID,
                    paymentGatewayData: {
                        provider: "ipn",
                        transactionId,
                        status: normalizedStatus,
                        receivedAt: new Date().toISOString(),
                    },
                },
            });

            await tx.appointment.update({
                where: { id: payment.appointmentId },
                data: {
                    paymentStatus: isSuccess
                        ? PaymentStatus.PAID
                        : PaymentStatus.UNPAID,
                },
            });
        });

        return {
            appointmentId: payment.appointmentId,
            transactionId,
            status: isSuccess ? PaymentStatus.PAID : PaymentStatus.UNPAID,
        };
    },
    validateStripeCheckoutSession: async (sessionId: string, user: any) => {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        const appointmentId = (session as any).metadata?.appointmentId;
        const paymentId = (session as any).metadata?.paymentId;

        if (!appointmentId || !paymentId) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                "Stripe session metadata is missing",
            );
        }

        const appointment = await prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { patient: true, payment: true },
        });

        if (!appointment) {
            throw new ApiError(httpStatus.NOT_FOUND, "Appointment not found");
        }

        // Ensure the logged-in patient owns this appointment
        if (user?.email && appointment.patient?.email !== user.email) {
            throw new ApiError(httpStatus.FORBIDDEN, "Forbidden!");
        }

        const paid = session.payment_status === "paid";
        const nextStatus = paid ? PaymentStatus.PAID : PaymentStatus.UNPAID;

        // Idempotent update: only update when there is a change.
        await prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: nextStatus,
                    paymentGatewayData: {
                        provider: "stripe-validate",
                        sessionId,
                        payment_status: session.payment_status,
                        validatedAt: new Date().toISOString(),
                    },
                },
            });

            await tx.appointment.update({
                where: { id: appointmentId },
                data: { paymentStatus: nextStatus },
            });
        });

        return {
            appointmentId,
            paymentId,
            status: nextStatus,
        };
    },
};
