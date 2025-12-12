import mongoose from 'mongoose';
import axios from 'axios';
import admin from 'firebase-admin';
import schedule from 'node-schedule';
import { User } from '../Models/User.model.js';
import { Donation } from '../Models/donor.model.js';
import { RequestBlood } from '../Models/Request.model.js';
import { firebaseDB } from '../Utils/firebase.js';


const addressCache = new Map();
const BLOOD_COMPATIBILITY = {
    "A+": ["A+", "A-", "O+", "O-"],
    "A-": ["A-", "O-"],
    "B+": ["B+", "B-", "O+", "O-"],
    "B-": ["B-", "O-"],
    "AB+": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    "AB-": ["A-", "B-", "AB-", "O-"],
    "O+": ["O+", "O-"],
    "O-": ["O-"]
};

const deleteExpiredRequests = async () => {
    try {
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        
        const expiredRequests = await RequestBlood.find({
            createdAt: { $lt: fortyEightHoursAgo },
            status: { $ne: 'completed' }
        });
        
        for (const request of expiredRequests) {
            // Delete from Firebase chat if exists
            const chatId = `chat_${request._id}`;
            await db.ref(`chats/${chatId}`).remove();
            
            // Delete request from MongoDB
            await RequestBlood.findByIdAndDelete(request._id);
            
            console.log(`Deleted expired request: ${request._id}`);
        }
        
        console.log(`Auto-deleted ${expiredRequests.length} expired requests`);
    } catch (error) {
        console.error('Error deleting expired requests:', error);
    }
};

// Schedule auto-delete every hour
schedule.scheduleJob('0 * * * *', deleteExpiredRequests);

// ========== HELPER FUNCTIONS ==========
const getCompatibleBloodTypes = (bloodType) => {
    return BLOOD_COMPATIBILITY[bloodType] || [];
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

// ========== GEOCODING ==========
const geocodeAddress = async (address) => {
    if (addressCache.has(address)) {
        return addressCache.get(address);
    }
    
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json`,
            {
                params: {
                    address: address,
                    key: process.env.GOOGLE_MAPS_API_KEY
                }
            }
        );
        
        if (response.data.results && response.data.results[0]) {
            const { lat, lng } = response.data.results[0].geometry.location;
            const coordinates = { latitude: lat, longitude: lng };
            addressCache.set(address, coordinates);
            return coordinates;
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
};

// ========== FIND NEARBY DONORS FROM FIREBASE ==========
const findNearbyDonorsFromFirebase = async (hospitalCoords, requiredBloodType, radiusKm = 10) => {
    try {
        const startTime = Date.now();
        
        // Get ALL user locations from Firebase Realtime DB
        const snapshot = await db.ref('userLocations').once('value');
        const allUserLocations = snapshot.val() || {};
        
        // Get compatible blood types
        const compatibleBloodTypes = getCompatibleBloodTypes(requiredBloodType);
        
        // Get ALL users with matching blood type from MongoDB
        const usersWithMatchingBlood = await User.find({
            bloodGroup: { $in: compatibleBloodTypes },
            isDonor: true,
            FCMtoken: { $exists: true, $ne: null }
        }).select('_id FCMtoken username bloodGroup phone').lean();
        
        // Create a map for quick lookup
        const userBloodMap = {};
        usersWithMatchingBlood.forEach(user => {
            userBloodMap[user._id.toString()] = {
                FCMtoken: user.FCMtoken,
                username: user.username,
                bloodGroup: user.bloodGroup,
                phone: user.phone
            };
        });
        
        // Filter users who are within 10km AND have matching blood type
        const nearbyDonors = [];
        
        Object.entries(allUserLocations).forEach(([userId, location]) => {
            if (userBloodMap[userId]) {
                const distance = calculateDistance(
                    hospitalCoords.latitude,
                    hospitalCoords.longitude,
                    location.latitude,
                    location.longitude
                );
                
                if (distance <= radiusKm) {
                    nearbyDonors.push({
                        _id: userId,
                        FCMtoken: userBloodMap[userId].FCMtoken,
                        username: userBloodMap[userId].username,
                        bloodGroup: userBloodMap[userId].bloodGroup,
                        phone: userBloodMap[userId].phone,
                        distance: parseFloat(distance.toFixed(2))
                    });
                }
            }
        });
        
        // Sort by distance (closest first)
        nearbyDonors.sort((a, b) => a.distance - b.distance);
        
        const endTime = Date.now();
        console.log(`Found ${nearbyDonors.length} nearby donors in ${endTime - startTime}ms`);
        
        return nearbyDonors;
        
    } catch (error) {
        console.error("Error finding nearby donors:", error);
        return [];
    }
};

// ========== SEND NOTIFICATIONS ==========
const sendNotificationsToDonors = async (donors, request) => {
    try {
        const validDonors = donors.filter(donor => donor.FCMtoken);
        
        if (validDonors.length === 0) {
            console.log("No donors with FCM tokens found");
            return [];
        }
        
        const tokens = validDonors.map(donor => donor.FCMtoken);
        
        const message = {
            notification: {
                title: `🩸 ${request.BloodType} Blood Needed`,
                body: `${request.unitRequired} unit(s) needed at ${request.HospitalAddress}`,
            },
            data: {
                requestId: request._id.toString(),
                bloodType: request.BloodType,
                hospitalAddress: request.HospitalAddress,
                unitRequired: request.unitRequired.toString(),
                type: 'BLOOD_REQUEST_NEARBY',
                timestamp: Date.now().toString()
            },
            tokens: tokens,
            android: { priority: 'high' },
            apns: { payload: { aps: { sound: 'default', badge: 1 } } }
        };
        
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`📤 Notifications: ${response.successCount} sent, ${response.failureCount} failed`);
        
        return validDonors.map(donor => donor._id);
        
    } catch (error) {
        console.error("❌ Notification error:", error);
        return [];
    }
};

// ========== MAIN FUNCTION: CREATE BLOOD REQUEST ==========
export const createBloodRequest = async (req, res) => {
    try {
        console.log("🚨 New Blood Request Received");
        
        const userId = req.user.id;
        const { 
            BloodType, 
            description, 
            unitRequired, 
            ContactPhone, 
            HospitalAddress 
        } = req.body;

        // Validate input
        if (!BloodType || !unitRequired || !ContactPhone || !HospitalAddress) {
            return res.status(400).json({ 
                success: false,
                error: "Missing required fields" 
            });
        }

        // Convert hospital address to coordinates
        const hospitalCoords = await geocodeAddress(HospitalAddress);
        if (!hospitalCoords) {
            return res.status(400).json({ 
                success: false,
                error: "Could not find hospital location" 
            });
        }

        // Create request with expiration time (48 hours)
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
        
        const bloodRequest = new RequestBlood({
            RequestPerson: userId,
            BloodType,
            description,
            unitRequired: parseInt(unitRequired),
            ContactPhone,
            HospitalAddress,
            location: {
                type: "Point",
                coordinates: [hospitalCoords.longitude, hospitalCoords.latitude]
            },
            expiresAt: expiresAt,
            status: 'active'
        });

        await bloodRequest.save();

        // Find nearby donors with matching blood type
        const nearbyDonors = await findNearbyDonorsFromFirebase(hospitalCoords, BloodType, 10);
        
        // Send notifications
        let notifiedDonorIds = [];
        if (nearbyDonors.length > 0) {
            notifiedDonorIds = await sendNotificationsToDonors(nearbyDonors, bloodRequest);
            
            // Update request with notified donors
            bloodRequest.notifiedUsers = notifiedDonorIds;
            bloodRequest.notificationSent = true;
            await bloodRequest.save();
        }

        res.status(201).json({
            success: true,
            message: "Blood request created successfully",
            data: {
                requestId: bloodRequest._id,
                expiresAt: expiresAt,
                donorsFound: nearbyDonors.length,
                notificationsSent: notifiedDonorIds.length
            }
        });

    } catch (error) {
        console.error("❌ Error creating request:", error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};

// ========== ACCEPT BLOOD REQUEST ==========
export const acceptBloodRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const donorId = req.user.id;

        // Find request
        const request = await RequestBlood.findById(requestId);
        if (!request) {
            return res.status(404).json({ 
                success: false, 
                error: "Request not found" 
            });
        }

        // Check if request is still active
        if (request.status !== 'active' || new Date() > request.expiresAt) {
            return res.status(400).json({ 
                success: false, 
                error: "This request is no longer available" 
            });
        }

        // Get donor info
        const donor = await User.findById(donorId);
        if (!donor) {
            return res.status(404).json({ 
                success: false, 
                error: "Donor not found" 
            });
        }

        // Check if donor is eligible (not donated recently)
        if (donor.lastDonationDate) {
            const daysSinceLastDonation = Math.floor(
                (new Date() - new Date(donor.lastDonationDate)) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceLastDonation < 90) {
                return res.status(400).json({
                    success: false,
                    error: `You can only donate blood every 90 days. Last donation: ${daysSinceLastDonation} days ago`
                });
            }
        }

        // Add donation to request
        const newDonation = {
            donor: donorId,
            unitsDonated: 1,
            donationDate: new Date(),
            status: 'scheduled'
        };

        request.donations.push(newDonation);
        
        // Update request status if enough units are donated
        const totalDonated = request.donations.reduce((sum, d) => 
            d.status === 'completed' ? sum + d.unitsDonated : sum, 0);
        
        if (totalDonated + 1 >= request.unitRequired) {
            request.status = 'completed';
        } else {
            request.status = 'partially_fulfilled';
        }
        
        await request.save();

        // Create donation record
        const donation = new Donation({
            donor: donorId,
            request: requestId,
            status: 'scheduled',
            scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Schedule for next day
        });
        await donation.save();

        // Create chat in Firebase
        const chatId = `chat_${requestId}_${donorId}`;
        const chatData = {
            requestId: requestId,
            requesterId: request.RequestPerson.toString(),
            donorId: donorId,
            bloodType: request.BloodType,
            hospitalAddress: request.HospitalAddress,
            createdAt: Date.now(),
            status: 'active',
            messages: {
                [Date.now()]: {
                    senderId: 'system',
                    message: `${donor.username} has accepted to donate blood. You can now chat here.`,
                    timestamp: Date.now(),
                    type: 'system'
                }
            }
        };

        await db.ref(`chats/${chatId}`).set(chatData);

        // Send notification to requester
        const requester = await User.findById(request.RequestPerson);
        if (requester && requester.FCMtoken) {
            await admin.messaging().send({
                token: requester.FCMtoken,
                notification: {
                    title: "🎉 Donor Found!",
                    body: `${donor.username} has accepted your blood request`
                },
                data: {
                    type: 'DONOR_ACCEPTED',
                    requestId: requestId,
                    donorId: donorId,
                    donorName: donor.username,
                    donorPhone: donor.phone,
                    chatId: chatId
                }
            });
        }

        res.json({
            success: true,
            message: "Successfully accepted the blood request",
            data: {
                requestId: requestId,
                chatId: chatId,
                donorContact: donor.phone,
                hospitalAddress: request.HospitalAddress,
                nextSteps: [
                    "Contact the requester via chat",
                    "Visit the hospital within 24 hours",
                    "Bring your ID proof"
                ]
            }
        });

    } catch (error) {
        console.error("❌ Error accepting request:", error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};

// ========== GET ACTIVE REQUESTS ==========
export const getActiveRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        
        const compatibleBloodTypes = getCompatibleBloodTypes(user.bloodGroup);
        
        const requests = await RequestBlood.find({
            status: 'active',
            BloodType: { $in: compatibleBloodTypes },
            expiresAt: { $gt: new Date() }
        })
        .populate('RequestPerson', 'username phone')
        .sort({ createdAt: -1 })
        .limit(20);
        
        res.json({
            success: true,
            requests: requests
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};

// ========== GET REQUEST DETAILS ==========
export const getRequestDetails = async (req, res) => {
    try {
        const { requestId } = req.params;
        
        const request = await RequestBlood.findById(requestId)
            .populate('RequestPerson', 'username phone email')
            .populate('donations.donor', 'username phone bloodGroup');
        
        if (!request) {
            return res.status(404).json({ 
                success: false, 
                error: "Request not found" 
            });
        }
        
        // Calculate time remaining
        const timeRemaining = Math.floor((request.expiresAt - new Date()) / (1000 * 60 * 60));
        
        res.json({
            success: true,
            request: request,
            timeRemaining: `${timeRemaining} hours`,
            isExpired: new Date() > request.expiresAt
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};

// ========== DELETE EXPIRED REQUESTS MANUALLY ==========
export const cleanupExpiredRequests = async (req, res) => {
    try {
        await deleteExpiredRequests();
        res.json({
            success: true,
            message: "Cleanup completed"
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};

// ========== EXPORT ALL FUNCTIONS ==========
export default {
    createBloodRequest,
    acceptBloodRequest,
    getActiveRequests,
    getRequestDetails,
    cleanupExpiredRequests
};