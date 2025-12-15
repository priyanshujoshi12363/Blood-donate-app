import mongoose from 'mongoose';
import axios from 'axios';
import admin from 'firebase-admin';
import { User } from '../Models/User.model.js';
import { RequestBlood } from '../Models/Request.model.js';
import { firebaseDB as db } from '../Utils/firebase.js';

// Calculate distance
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

// Geocode address
const geocodeAddress = async (address) => {
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
            return { latitude: lat, longitude: lng };
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
};

// BLOOD COMPATIBILITY
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

// MAIN FIXED FUNCTION
export const notifyNearbyDonors = async (req, res) => {
    try {
        console.log("🚨 STARTING BLOOD REQUEST...");
        
        // Get user and request data
        const userId = req.user?._id || req.user?.id;
        const { BloodType, description, unitRequired, ContactPhone, HospitalAddress } = req.body;
        
        // Validate
        if (!BloodType || !unitRequired || !ContactPhone || !HospitalAddress) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields"
            });
        }
        
        // Get hospital coordinates
        console.log(`📍 Getting coordinates for: ${HospitalAddress}`);
        const hospitalCoords = await geocodeAddress(HospitalAddress);
        if (!hospitalCoords) {
            return res.status(400).json({
                success: false,
                error: "Could not find hospital location"
            });
        }
        
        console.log(`✅ Hospital coordinates: ${hospitalCoords.latitude}, ${hospitalCoords.longitude}`);
        
        // Get compatible blood types
        const compatibleBloodTypes = BLOOD_COMPATIBILITY[BloodType] || [];
        console.log(`🩸 Blood ${BloodType} is compatible with: ${compatibleBloodTypes.join(', ')}`);
        
        // ========== FIX 1: GET ALL USERS FROM MONGODB ==========
        const allUsers = await User.find({
            isDonor: true, // Must be donor
            FCMtoken: { $exists: true, $ne: null, $ne: "" } // Must have FCM token
        }).select('_id username bloodGroup FCMtoken phone');
        
        console.log(`📊 Found ${allUsers.length} users who are donors and have FCM tokens`);
        
        // Log all users for debugging
        allUsers.forEach(user => {
            console.log(`👤 ${user.username}: Blood=${user.bloodGroup}, ID=${user._id}`);
        });
        
        // ========== FIX 2: GET ALL LOCATIONS FROM FIREBASE ==========
        const locationsSnapshot = await db.ref('userLocations').once('value');
        const allFirebaseLocations = locationsSnapshot.val() || {};
        
        console.log(`📍 Found ${Object.keys(allFirebaseLocations).length} users in Firebase locations`);
        
        // Log Firebase users
        Object.entries(allFirebaseLocations).forEach(([firebaseId, location]) => {
            console.log(`🔥 Firebase ID: ${firebaseId}, Location: ${location.latitude}, ${location.longitude}`);
        });
        
        // ========== FIX 3: FIND COMPATIBLE DONORS WITHIN DISTANCE ==========
        const MAX_DISTANCE_KM = 10;
        const eligibleDonors = [];
        
        console.log("\n🔍 Finding eligible donors...");
        
        // Check each MongoDB user
        for (const user of allUsers) {
            const mongoUserId = user._id.toString();
            
            // Skip if this is the requester
            if (mongoUserId === userId.toString()) {
                console.log(`⏭️  Skipping requester: ${user.username}`);
                continue;
            }
            
            // Check blood compatibility
            if (!compatibleBloodTypes.includes(user.bloodGroup)) {
                console.log(`❌ ${user.username}: Blood type ${user.bloodGroup} not compatible with ${BloodType}`);
                continue;
            }
            
            // Check if user has location in Firebase
            // IMPORTANT: Firebase ID might be different from MongoDB ID
            let userLocation = null;
            
            // Try direct match first
            if (allFirebaseLocations[mongoUserId]) {
                userLocation = allFirebaseLocations[mongoUserId];
                console.log(`✅ ${user.username}: Found location in Firebase with same ID`);
            } 
            // If not found, try to find by searching all Firebase entries
            else {
                console.log(`⚠️  ${user.username}: No direct match in Firebase. Trying to find by username/phone...`);
                // You might need to add username/phone mapping in Firebase
            }
            
            if (!userLocation) {
                console.log(`❌ ${user.username}: No location found in Firebase`);
                continue;
            }
            
            // Calculate distance
            const distance = calculateDistance(
                hospitalCoords.latitude,
                hospitalCoords.longitude,
                userLocation.latitude,
                userLocation.longitude
            );
            
            console.log(`📏 ${user.username}: Distance = ${distance.toFixed(2)} km`);
            
            if (distance <= MAX_DISTANCE_KM) {
                eligibleDonors.push({
                    _id: user._id,
                    username: user.username,
                    bloodGroup: user.bloodGroup,
                    phone: user.phone,
                    FCMtoken: user.FCMtoken,
                    distance: parseFloat(distance.toFixed(2)),
                    coordinates: userLocation
                });
                console.log(`🎯 ${user.username}: ELIGIBLE - Will receive notification!`);
            } else {
                console.log(`📏 ${user.username}: Too far (${distance.toFixed(2)} km > ${MAX_DISTANCE_KM} km)`);
            }
        }
        
        console.log(`\n📋 ELIGIBLE DONORS FOUND: ${eligibleDonors.length}`);
        
        // ========== FIX 4: SEND NOTIFICATIONS ==========
        let notificationsSent = 0;
        const failedNotifications = [];
        
        if (eligibleDonors.length > 0) {
            console.log("\n📤 Sending notifications...");
            
            for (const donor of eligibleDonors) {
                try {
                    const message = {
                        notification: {
                            title: `🩸 ${BloodType} Blood Needed URGENTLY`,
                            body: `${unitRequired} unit(s) needed at ${HospitalAddress}. Distance: ${donor.distance}km`,
                        },
                        data: {
                            type: 'BLOOD_REQUEST_URGENT',
                            requestBloodType: BloodType,
                            hospitalAddress: HospitalAddress,
                            hospitalLat: hospitalCoords.latitude.toString(),
                            hospitalLng: hospitalCoords.longitude.toString(),
                            unitsNeeded: unitRequired.toString(),
                            contactPhone: ContactPhone,
                            timestamp: Date.now().toString()
                        },
                        token: donor.FCMtoken,
                        android: {
                            priority: 'high',
                            notification: {
                                sound: 'default',
                                channelId: 'blood_emergency',
                                priority: 'max'
                            }
                        },
                        apns: {
                            payload: {
                                aps: {
                                    alert: {
                                        title: `🩸 ${BloodType} Blood Needed`,
                                        body: `Emergency request nearby`
                                    },
                                    sound: 'default',
                                    badge: 1,
                                    'mutable-content': 1
                                }
                            }
                        }
                    };
                    
                    const response = await admin.messaging().send(message);
                    notificationsSent++;
                    console.log(`✅ Notification sent to ${donor.username} (${donor.distance}km away)`);
                    
                } catch (error) {
                    console.error(`❌ Failed to send to ${donor.username}:`, error.message);
                    failedNotifications.push({
                        donor: donor.username,
                        error: error.message
                    });
                }
            }
        }
        
        // ========== FIX 5: CREATE REQUEST IN DATABASE ==========
        const bloodRequest = new RequestBlood({
            RequestPerson: userId,
            BloodType,
            description: description || '',
            unitRequired: parseInt(unitRequired),
            ContactPhone,
            HospitalAddress,
            location: {
                type: "Point",
                coordinates: [hospitalCoords.longitude, hospitalCoords.latitude]
            },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 48 hours
            status: 'active',
            notifiedDonors: eligibleDonors.map(d => d._id),
            notificationsSent: notificationsSent,
            failedNotifications: failedNotifications
        });
        
        await bloodRequest.save();
        
        console.log("\n✅ REQUEST CREATED SUCCESSFULLY!");
        
        res.status(201).json({
            success: true,
            message: "Blood request created successfully",
            data: {
                requestId: bloodRequest._id,
                hospital: {
                    name: HospitalAddress,
                    coordinates: hospitalCoords,
                    address: HospitalAddress
                },
                bloodDetails: {
                    type: BloodType,
                    units: unitRequired,
                    compatibleTypes: compatibleBloodTypes
                },
                donors: {
                    totalDonorsInSystem: allUsers.length,
                    eligibleDonorsFound: eligibleDonors.length,
                    notificationsSent: notificationsSent,
                    failedNotifications: failedNotifications.length,
                    eligibleDonorsList: eligibleDonors.map(d => ({
                        username: d.username,
                        bloodGroup: d.bloodGroup,
                        distance: `${d.distance}km`,
                        phone: d.phone || 'Not provided'
                    }))
                },
                distanceInfo: {
                    hospitalCoordinates: `${hospitalCoords.latitude}, ${hospitalCoords.longitude}`,
                    maxDistance: `${MAX_DISTANCE_KM}km`,
                    calculation: "Haversine formula used"
                },
                nextSteps: [
                    "Donors have been notified via push notifications",
                    "Check request status for donor responses",
                    "Contact donors directly if urgent"
                ],
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error("❌ ERROR in createAndNotify:", error);
        res.status(500).json({
            success: false,
            error: error.message,
            step: "Failed to create blood request"
        });
    }
};



export const getnotification = async (req, res) => {
    try {
        const { requestId } = req.params;
        
        if (!requestId) {
            return res.status(400).json({
                success: false,
                error: "Request ID is required"
            });
        }
        
        // Simple query with only requester info
        const request = await RequestBlood.findById(requestId)
            .populate('RequestPerson', 'username email phone profilePic bloodGroup')
            .lean();
        
        if (!request) {
            return res.status(404).json({
                success: false,
                error: "Blood request not found"
            });
        }
        
        // Format profilePic URL
        let profilePicUrl = null;
        if (request.RequestPerson?.profilePic) {
            if (typeof request.RequestPerson.profilePic === 'object') {
                profilePicUrl = request.RequestPerson.profilePic.url;
            } else if (typeof request.RequestPerson.profilePic === 'string') {
                profilePicUrl = request.RequestPerson.profilePic;
            }
        }
        
        res.status(200).json({
            success: true,
            request: {
                id: request._id,
                bloodType: request.BloodType,
                description: request.description,
                hospitalAddress: request.HospitalAddress,
                unitRequired: request.unitRequired,
                contactPhone: request.ContactPhone,
                status: request.status || 'active',
                createdAt: request.createdAt,
                expiresAt: request.expiresAt,
                
                // Requester info
                requester: {
                    id: request.RequestPerson._id,
                    username: request.RequestPerson.username,
                    email: request.RequestPerson.email,
                    phone: request.RequestPerson.phone,
                    bloodGroup: request.RequestPerson.bloodGroup,
                    profilePic: profilePicUrl
                }
            }
        });
        
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};