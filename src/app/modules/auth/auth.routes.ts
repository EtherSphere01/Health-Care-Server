import express, { NextFunction, Request, Response } from "express";
import { authController } from "./auth.controller";

const router = express.Router();

export const authRoutes = router;

router.post("/login", authController.login);
router.post("/logout", authController.logout);
