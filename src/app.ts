import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import cron from "node-cron";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import router from "./app/routes";
import { PaymentController } from "./app/modules/payment/payment.controller";
import { AppointmentService } from "./app/modules/appointment/appointment.service";
import { createOpenApiSpec } from "./docs/openapi";

const app: Application = express();
app.use(cookieParser());

app.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    PaymentController.handleStripeWebhookEvent,
);

const backendOrigins = [
    process.env.SWAGGER_SERVER_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
].filter(Boolean) as string[];

const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    ...backendOrigins,
    ...(process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(",")
              .map((s) => s.trim())
              .filter(Boolean)
        : []),
];

// If the request is same-origin, CORS should not block it.
// Some browsers still include the Origin header on same-origin POSTs;
// the `cors` middleware would otherwise enforce the allowlist.
app.use((req, _res, next) => {
    const origin = req.headers.origin;
    const host = req.headers.host;

    if (
        origin &&
        host &&
        (origin === `https://${host}` || origin === `http://${host}`)
    ) {
        delete (req.headers as any).origin;
    }

    next();
});

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            return callback(new Error(`CORS blocked for origin: ${origin}`));
        },
        credentials: true,
    }),
);

//parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger / OpenAPI
app.get("/docs-json", (req: Request, res: Response) => {
    res.json(createOpenApiSpec());
});

app.get(["/docs", "/docs/"], (req: Request, res: Response) => {
    // Use CDN assets so this works reliably on serverless platforms
    // where swagger-ui-dist static files may not be bundled.
    const specUrl = "/docs-json";
    const html = `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>API Docs</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
        <script>
            window.onload = function () {
                window.ui = SwaggerUIBundle({
                    url: ${JSON.stringify(specUrl)},
                    dom_id: '#swagger-ui',
                    deepLinking: true,
                    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
                    layout: 'StandaloneLayout',
                    persistAuthorization: true,
                });
            };
        </script>
    </body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
});

cron.schedule("*/10 * * * *", () => {
    try {
        console.log(
            "🔄 Running unpaid appointment cleanup at",
            new Date().toISOString(),
        );
        AppointmentService.cancelUnpaidAppointments();
    } catch (err) {
        console.error("❌ Cron job error:", err);
    }
});

app.get("/", (req: Request, res: Response) => {
    res.send({
        Message: "Nexus Health server..",
    });
});

app.use("/api/v1", router);

app.use(globalErrorHandler);

app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: "API NOT FOUND!",
        error: {
            path: req.originalUrl,
            message: "Your requested path is not found!",
        },
    });
});

export default app;
