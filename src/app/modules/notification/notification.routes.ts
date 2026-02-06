import express from "express";
import { UserRole } from "@prisma/client";
import auth from "../../middlewares/auth";
import { notificationController } from "./notification.controller";

const router = express.Router();

router.get(
    "/my-notifications",
    auth(
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN,
        UserRole.DOCTOR,
        UserRole.PATIENT,
    ),
    notificationController.getMyNotifications,
);

router.patch(
    "/mark-all-read",
    auth(
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN,
        UserRole.DOCTOR,
        UserRole.PATIENT,
    ),
    notificationController.markAllAsRead,
);

router.patch(
    "/:id/read",
    auth(
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN,
        UserRole.DOCTOR,
        UserRole.PATIENT,
    ),
    notificationController.markAsRead,
);

export const NotificationRoutes = router;
