type IOptions = {
    page?: number | string;
    limit?: number | string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
};

type IOptionsResult = {
    page: number;
    limit: number;
    skip: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
};

const calculatePagination = (options: IOptions) => {
    const page: number = Number(options.page) || 1;
    const limit: number = Number(options.limit) || 10;
    const skip: number = (page - 1) * limit;

    const sortBy: string = options.sortBy || "createdAt";
    const sortOrder: "asc" | "desc" =
        options.sortOrder === "desc" ? "desc" : "asc";

    const result: IOptionsResult = {
        page,
        limit,
        skip,
        sortBy,
        sortOrder,
    };
    return result;
};

export const paginationHelper = {
    calculatePagination,
};
