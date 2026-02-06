import { Response } from "express";

const sendResponse = <T>(
    res: Response,
    jsonData: {
        statusCode: number;
        success: boolean;
        message: string;
        meta?: {
            page: number;
            limit: number;
            total: number;
            totalPage?: number;
        };
        data: T | null | undefined;
    },
) => {
    const meta = jsonData.meta
        ? {
              ...jsonData.meta,
              totalPage:
                  jsonData.meta.totalPage ??
                  Math.max(
                      1,
                      Math.ceil(jsonData.meta.total / jsonData.meta.limit),
                  ),
          }
        : jsonData.meta;

    res.status(jsonData.statusCode).json({
        success: jsonData.success,
        message: jsonData.message,
        meta: meta || null || undefined,
        data: jsonData.data || null || undefined,
    });
};

export default sendResponse;
