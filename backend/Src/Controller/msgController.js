// controllers/chatController.js
import { admin , firebaseDB } from "../Utils/firebase.js";
import { User } from "../Models/User.model.js";
export const sendMessage = async (req, res) => {
    try {
        const { receiverId, text } = req.body;
        const senderId = req.user._id.toString();
        
        console.log('=== DEBUG SEND MESSAGE ===');
        console.log('Sender ID:', senderId);
        console.log('Receiver ID from body:', receiverId);
        console.log('Text:', text);
        
        // Validate receiverId
        if (!receiverId || receiverId.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'receiverId is required and cannot be empty'
            });
        }
        
        // Ensure receiverId is string
        const receiverIdStr = receiverId.toString().trim();
        
        if (receiverIdStr === senderId) {
            return res.status(400).json({
                success: false,
                error: 'Cannot send message to yourself'
            });
        }
        
        // Create chat ID (sorted)
        const chatId = [senderId, receiverIdStr].sort().join('_');
        
        console.log('Generated chatId:', chatId);
        
        // Create and save message
        const messageId = Date.now().toString();
        const messageData = {
            senderId: senderId,
            receiverId: receiverIdStr,
            text: text.trim(),
            timestamp: Date.now()
        };
        
        console.log('Saving message to Firebase:', messageData);
        
        // 1️⃣ Save message to Firebase Realtime DB
        await firebaseDB.ref(`chats/${chatId}/messages/${messageId}`).set(messageData);
        
        // 2️⃣ Update chat metadata
        await firebaseDB.ref(`chats/${chatId}`).update({
            lastMessage: text.trim(),
            lastMessageTime: Date.now(),
            updatedAt: Date.now()
        });
        
        // 3️⃣ SEND PUSH NOTIFICATION TO RECEIVER
        try {
            console.log('🔍 Looking for receiver in MongoDB:', receiverIdStr);
            
            // Find receiver in MongoDB to get FCMtoken
            const receiver = await User.findById(receiverIdStr).select('FCMtoken username');
            
            if (receiver && receiver.FCMtoken) {
                console.log('📱 Found receiver FCM token:', receiver.FCMtoken.substring(0, 20) + '...');
                
                // Get sender info for notification
                const sender = await User.findById(senderId).select('username');
                
                // Create notification payload
                const notificationMessage = {
                    notification: {
                        title: `💬 ${sender?.username || 'Someone'}`,
                        body: text.length > 50 ? text.substring(0, 47) + '...' : text,
                        sound: 'default'
                    },
                    data: {
                        type: 'NEW_CHAT_MESSAGE',
                        chatId: chatId,
                        senderId: senderId,
                        message: text,
                        timestamp: Date.now().toString()
                    },
                    token: receiver.FCMtoken,
                    android: {
                        priority: 'high',
                        ttl: 3600 * 1000 // 1 hour
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: 'default',
                                badge: 1
                            }
                        }
                    }
                };
                
                // Send notification
                const response = await admin.messaging().send(notificationMessage);
                console.log('✅ Push notification sent:', response);
                
                // Update message with notification status
                await firebaseDB.ref(`chats/${chatId}/messages/${messageId}`).update({
                    notificationSent: true,
                    notificationId: response
                });
                
            } else {
                console.log('⚠️ No FCM token found for receiver:', receiverIdStr);
            }
            
        } catch (notificationError) {
            console.error('❌ Failed to send notification:', notificationError.message);
            // Don't fail the whole request if notification fails
            // Just log it and continue
        }
        
        res.json({
            success: true,
            chatId: chatId,
            messageId: messageId,
            notificationSent: true
        });
        
    } catch (error) {
        console.error('❌ Send message error:', error.message);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};
// ========== 2. GET MESSAGES (FIXED) ==========
export const getMessages = async (req, res) => {
    try {
        const { userId } = req.params; // This should be receiverId
        const senderId = req.user._id.toString();
        
        console.log('=== DEBUG GET MESSAGES ===');
        console.log('Request params:', req.params);
        console.log('User ID from params:', userId);
        console.log('Sender ID:', senderId);
        
        if (!userId || userId.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'User ID parameter is required'
            });
        }
        
        const receiverIdStr = userId.toString().trim();
        
        // Create correct chat ID
        const chatId = [senderId, receiverIdStr].sort().join('_');
        
        console.log('Looking for chatId:', chatId);
        
        // Check if chat exists
        const chatSnapshot = await firebaseDB.ref(`chats/${chatId}`).once('value');
        
        if (!chatSnapshot.exists()) {
            console.log('Chat not found in Firebase');
            return res.json({
                success: true,
                chatId: chatId,
                messages: [],
                message: 'No chat history found'
            });
        }
        
        console.log('Chat found:', chatSnapshot.val());
        
        // Get messages
        const messagesSnapshot = await firebaseDB.ref(`chats/${chatId}/messages`)
            .orderByChild('timestamp')
            .once('value');
        
        const messages = messagesSnapshot.val() || {};
        
        console.log('Messages found:', Object.keys(messages).length);
        
        // Convert to array
        const messagesArray = Object.entries(messages).map(([id, msg]) => ({
            id: id,
            ...msg
        }));
        
        res.json({
            success: true,
            chatId: chatId,
            messages: messagesArray,
            count: messagesArray.length
        });
        
    } catch (error) {
        console.error('❌ Get messages error:', error.message);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};
export const getMyChats = async (req, res) => {
    try {
        const userId = req.user._id.toString();
        
        // Get all chats
        const snapshot = await firebaseDB.ref('chats').once('value');
        const allChats = snapshot.val() || {};
        
        const myChats = [];
        
        for (const [chatId, chatData] of Object.entries(allChats)) {
            // Extract user IDs from chatId (format: "user1_user2")
            const userIds = chatId.split('_');
            
            // Check if current user is in this chat
            if (userIds.includes(userId)) {
                // Get the other user ID
                const otherUserId = userIds.find(id => id !== userId);
                
                myChats.push({
                    chatId: chatId,
                    lastMessage: chatData.lastMessage || "No messages yet",
                    lastMessageTime: chatData.lastMessageTime || Date.now(),
                    withUser: otherUserId,
                    unread: 0
                });
            }
        }
        
        // Sort by last message time
        myChats.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
        
        res.json({
            success: true,
            chats: myChats
        });
        
    } catch (error) {
        console.error('Get chats error:', error);
        res.status(500).json({ error: error.message });
    }
};