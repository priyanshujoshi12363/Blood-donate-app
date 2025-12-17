import { Router } from "express";
import { sendMessage , getMessages , getMyChats, getuserdatabyId } from "../Controller/msgController.js";
import { verifyToken } from "../Middleware/userauth.js";
const router = Router()


router.post('/send', verifyToken, sendMessage);

router.get('/messages/:userId', verifyToken, getMessages);

router.get('/my-chats', verifyToken, getMyChats);

router.get('/:userId' , getuserdatabyId)
export default router