import { Router } from "express";
import multer from "multer";
const storage = multer.diskStorage({});
export const upload = multer({ storage });
import { getUserData, Login, register , editUserData, logout, saveFCMToken , toggleDonorStatus} from "../Controller/UserController.js";
import { verifyToken } from "../Middleware/userauth.js";

const router = Router()

router.post("/register", upload.single("profile_pic"), register);
router.post('/login' , Login)
router.get('/:userId' , verifyToken , getUserData)
router.patch(
  '/edit/:userId',
  upload.single('profilePic'), 
  editUserData
);

router.post('/logout/:userId' , verifyToken, logout)
router.post('/FCM' , verifyToken , saveFCMToken)
router.post('/isdonor' , toggleDonorStatus)

export default router;