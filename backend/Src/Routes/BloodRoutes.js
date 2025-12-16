import {Router} from "express"
import { verifyToken } from "../Middleware/userauth.js"
import { notifyNearbyDonors , getnotification, AcceptNotification} from "../Controller/BloodController.js"


const router = Router()



router.post('/notify' , verifyToken , notifyNearbyDonors)
router.post('/notification', getnotification);
router.post('/accept/:userId' , AcceptNotification)
export default router