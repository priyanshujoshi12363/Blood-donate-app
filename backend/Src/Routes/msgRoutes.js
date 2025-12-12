import { Router } from "express";
import { sendMessage , getMessages , getMyChats } from "../Controller/msgController.js";
import { verifyToken } from "../Middleware/userauth.js";
const router = Router()


router.post('/send', verifyToken, sendMessage);

router.get('/messages/:userId', verifyToken, getMessages);

router.get('/my-chats', verifyToken, getMyChats);


export default router