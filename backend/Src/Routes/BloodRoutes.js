import {Router} from "express"
import { verifyToken } from "../Middleware/userauth.js"
import { notifyNearbyDonors , getnotification} from "../Controller/BloodController.js"


const router = Router()



router.post('/notify' , verifyToken , notifyNearbyDonors)
router.get('/notification/:requestId', verifyToken, getnotification);

export default router