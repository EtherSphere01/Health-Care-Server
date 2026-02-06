import { z } from "zod";

const create = z.object({
    title: z.string({
        error: "Title is required!",
    }),
    icon: z.string().optional(),
});

export const SpecialtiesValidtaion = {
    create,
};
