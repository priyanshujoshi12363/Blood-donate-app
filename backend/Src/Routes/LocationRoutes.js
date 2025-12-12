import { Router } from "express";
import { autocompleteGujaratAddress, saveLocation } from "../Controller/locationController.js";

const router = Router();

router.post('/location/:userId' , saveLocation)
router.post('/autocomplete' , autocompleteGujaratAddress)

export default router;