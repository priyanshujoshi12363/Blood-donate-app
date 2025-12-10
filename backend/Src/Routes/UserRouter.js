import { Router } from "express";
import multer from "multer";
const storage = multer.diskStorage({});
export const upload = multer({ storage });
import { register } from "../Controller/UserController.js";

const router = Router()

router.post("/register", upload.single("profile_pic"), register);
