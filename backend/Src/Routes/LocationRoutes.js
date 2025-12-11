import { Router } from "express";
import { saveLocation } from "../Controller/locationController.js";

const router = Router();

router.post('/location/:userId' , saveLocation)

export default router;