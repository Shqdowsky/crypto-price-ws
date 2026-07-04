import { Router, type Request, type Response } from "express";
import { register, login } from "../service/auth.service.js";
import { AppError, isPgError, type ErrorResponse, type PgError } from "../../shared/types/error.js";
import type { AuthResult, ReqBody } from "../../shared/types/auth.js";
import {validate} from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../../schemas/auth.schema.js";

const router = Router();

type TypedRequest<B = {}, P extends Record<string, string> = {}, Q = {}> 
  = Request<P, any, B, Q>;

router.post("/register", validate(registerSchema), async (req: TypedRequest<ReqBody>, res: Response): Promise<void> => {
    try{
        const {username, email, password} = req.body;
        await register(username, email, password);
        res.status(201).send("Registered successfully");
    }catch(error){
        console.error(error)
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }
        if (isPgError(error) && error.code === "23505") {
            res.status(409).json({ message: "Email already registered" });
            return;
        }
        res.status(500).json({ message: "Unexpected registration error" });
    }
});
router.post("/login", validate(loginSchema), async(req: TypedRequest<Omit<ReqBody, 'username'>>, res: Response<AuthResult | Omit<ErrorResponse, 'code'>>): Promise<void> =>{
    try{
        const {email, password} = req.body;
        const {token, user} = await login(email, password);
        res.json({ token, user })
    }catch(error){
        console.error(error)
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ message: error.message });
            return
        }
        res.status(500).json({ message: "Unexpected login error" });
    }
});

export default router;