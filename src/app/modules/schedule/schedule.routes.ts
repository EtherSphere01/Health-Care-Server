import express from "express";
import { scheduleController } from "./schedule.controller";

const router = express.Router();

router.get("/", scheduleController.schedulesForDoctor);

router.post("/", scheduleController.insertIntoDB);

export const scheduleRoutes = router;
