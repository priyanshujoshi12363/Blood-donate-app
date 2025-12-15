import { Router } from "express";
import { locationSearch, saveLocation } from "../Controller/locationController.js";

const router = Router();

router.post('/location/:userId' , saveLocation)
router.get('/search' , locationSearch)
export default router;