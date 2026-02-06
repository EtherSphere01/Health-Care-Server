import express from "express";
import { PaymentController } from "./payment.controller";
import auth from "../../middlewares/auth";
import { UserRole } from "@prisma/client";

const router = express.Router();

// Webhook route is registered in app.ts before other middleware

// IPN-style callback (used by Postman collection + local verification)
router.get("/ipn", PaymentController.validateIpnCallback);

// Stripe return validation (fallback when webhook delivery isn't configured)
router.get(
    "/stripe/validate",
    auth(UserRole.PATIENT),
    PaymentController.validateStripeCheckoutSession,
);

export const PaymentRoutes = router;
