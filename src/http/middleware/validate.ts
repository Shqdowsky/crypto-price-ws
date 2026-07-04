import type { NextFunction, Request, Response } from "express";
import { prettifyError, type ZodType } from "zod";

export function validate<T>(schema: ZodType<T>){
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if(!result.success){
            res.status(400).json({ message: prettifyError(result.error) });
            return;
        }
        req.body = result.data;
        next();
    }
}