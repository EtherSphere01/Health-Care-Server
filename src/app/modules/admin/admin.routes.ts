import express from "express";
import authMiddleware from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { adminController } from "./admin.controller";

const router = express.Router();

router.get("/", authMiddleware(UserRole.ADMIN), adminController.getAllFromDB);

router.get(
    "/:id",
    authMiddleware(UserRole.ADMIN),
    adminController.getByIdFromDB,
);

router.patch(
    "/:id",
    authMiddleware(UserRole.ADMIN),
    adminController.updateIntoDB,
);

router.delete(
    "/:id",
    authMiddleware(UserRole.ADMIN),
    adminController.deleteFromDB,
);

export const adminRoutes = router;
