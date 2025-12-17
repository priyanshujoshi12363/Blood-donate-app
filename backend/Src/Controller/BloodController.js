import mongoose from 'mongoose';
import axios from 'axios';
import admin from 'firebase-admin';
import { User } from '../Models/User.model.js';
import { RequestBlood } from '../Models/Request.model.js';
import { firebaseDB as db } from '../Utils/firebase.js';
import { Donation } from '../Models/donor.model.js'
// Calculate distance
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

        // ========== CREATE REQUEST FIRST TO GET _id ==========
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
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
            status: 'Looking for Blood',
            notifiedDonors: [],
            notificationsSent: 0,
            failedNotifications: []
        });

        // Save to get the _id
        await bloodRequest.save();
        const requestId = bloodRequest._id.toString();

        console.log(`✅ Request created with ID: ${requestId}`);

        // ========== GET ALL USERS FROM MONGODB ==========
        const allUsers = await User.find({
            isDonor: true, // Must be donor
            FCMtoken: { $exists: true, $ne: null, $ne: "" } // Must have FCM token
        }).select('_id username bloodGroup FCMtoken phone');

        console.log(`📊 Found ${allUsers.length} users who are donors and have FCM tokens`);

        // ========== GET ALL LOCATIONS FROM FIREBASE ==========
        const locationsSnapshot = await db.ref('userLocations').once('value');
        const allFirebaseLocations = locationsSnapshot.val() || {};

        console.log(`📍 Found ${Object.keys(allFirebaseLocations).length} users in Firebase locations`);

        // ========== FIND COMPATIBLE DONORS WITHIN DISTANCE ==========
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
            let userLocation = null;

            // Try direct match first
            if (allFirebaseLocations[mongoUserId]) {
                userLocation = allFirebaseLocations[mongoUserId];
                console.log(`✅ ${user.username}: Found location in Firebase with same ID`);
            }
            // Try to find by searching all Firebase entries
            else {
                console.log(`⚠️  ${user.username}: No direct match in Firebase.`);
                continue; // Skip if no location found
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

        // ========== SEND NOTIFICATIONS WITH REQUEST ID ==========
        let notificationsSent = 0;
        const failedNotifications = [];

        if (eligibleDonors.length > 0) {
            console.log("\n📤 Sending notifications with request ID:", requestId);

            for (const donor of eligibleDonors) {
                try {
                    // FCM message with requestId
                    const message = {
                        notification: {
                            title: `🩸 ${BloodType} Blood Needed`,
                            body: `${unitRequired} unit(s) needed at ${HospitalAddress}`,
                        },
                        data: {
                            // ESSENTIAL: Send the database _id
                            requestId: requestId, // This is the MongoDB _id
                            requestBloodType: BloodType,
                            hospitalAddress: HospitalAddress,
                            unitsNeeded: unitRequired.toString(),
                            contactPhone: ContactPhone,
                            distance: donor.distance.toString(),

                            // For React Native handling
                            type: 'blood_request',
                            screen: 'BloodRequestDetails',
                            click_action: 'OPEN_REQUEST_SCREEN',
                            channelId: 'blood_emergency',
                            timestamp: Date.now().toString(),
                            notificationId: `blood_request_${requestId}`,

                            // Extra info for display
                            title: `${BloodType} Blood Needed Urgently`,
                            body: `${unitRequired} unit(s) needed. Distance: ${donor.distance}km`,
                            requesterId: userId.toString()
                        },
                        token: donor.FCMtoken,
                        android: {
                            priority: 'high',
                            notification: {
                                sound: 'default',
                                channelId: 'blood_emergency',
                                priority: 'max',
                                click_action: 'OPEN_REQUEST_SCREEN'
                            }
                        },
                        apns: {
                            payload: {
                                aps: {
                                    alert: {
                                        title: `🩸 ${BloodType} Blood Needed`,
                                        body: `Emergency blood request nearby`
                                    },
                                    sound: 'default',
                                    badge: 1
                                },
                                // For iOS
                                requestId: requestId,
                                screen: 'BloodRequestDetails'
                            }
                        }
                    };

                    const response = await admin.messaging().send(message);
                    notificationsSent++;
                    console.log(`✅ Notification sent to ${donor.username} with requestId: ${requestId}`);

                } catch (error) {
                    console.error(`❌ Failed to send to ${donor.username}:`, error.message);
                    failedNotifications.push({
                        donorId: donor._id,
                        donorName: donor.username,
                        error: error.message
                    });
                }
            }
        }

        // ========== UPDATE REQUEST WITH NOTIFICATION RESULTS ==========
        bloodRequest.notifiedDonors = eligibleDonors.map(d => d._id);
        bloodRequest.notificationsSent = notificationsSent;
        bloodRequest.failedNotifications = failedNotifications;
        await bloodRequest.save();

        console.log("\n✅ REQUEST CREATED AND NOTIFICATIONS SENT!");

        res.status(201).json({
            success: true,
            message: "Blood request created successfully",
            data: {
                requestId: requestId,
                request: {
                    _id: requestId,
                    BloodType,
                    description: description || '',
                    HospitalAddress,
                    unitRequired,
                    ContactPhone,
                    status: 'Looking for Blood',
                    createdAt: bloodRequest.createdAt
                },
                hospital: {
                    coordinates: hospitalCoords,
                    address: HospitalAddress
                },
                donors: {
                    totalDonorsInSystem: allUsers.length,
                    eligibleDonorsFound: eligibleDonors.length,
                    notificationsSent: notificationsSent,
                    failedNotifications: failedNotifications.length,
                    eligibleDonorsList: eligibleDonors.map(d => ({
                        id: d._id,
                        username: d.username,
                        bloodGroup: d.bloodGroup,
                        distance: `${d.distance}km`,
                        phone: d.phone || 'Not provided'
                    }))
                },
                notificationInfo: {
                    requestIdSentInNotifications: requestId,
                    compatibleBloodTypes: compatibleBloodTypes,
                    maxDistanceKm: MAX_DISTANCE_KM
                }
            }
        });

    } catch (error) {
        console.error("❌ ERROR in notifyNearbyDonors:", error);
        res.status(500).json({
            success: false,
            error: error.message,
            step: "Failed to create blood request"
        });
    }
};

export const getnotification = async (req, res) => {
    try {
        const { requestIds } = req.body;

        if (!Array.isArray(requestIds)) {
            return res.status(400).json({
                success: false,
                error: "Request IDs must be an array"
            });
        }

        // Use aggregation to filter more efficiently
        const requests = await RequestBlood.aggregate([
            {
                $match: {
                    _id: { $in: requestIds.map(id => new mongoose.Types.ObjectId(id)) }
                }
            },
            {
                $match: {
                    $expr: { $eq: [{ $size: "$donations" }, 0] } // Empty donations
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'RequestPerson',
                    foreignField: '_id',
                    as: 'requester'
                }
            },
            {
                $unwind: '$requester'
            },
            {
                $project: {
                    _id: 1,
                    BloodType: 1,
                    description: 1,
                    HospitalAddress: 1,
                    unitRequired: 1,
                    ContactPhone: 1,
                    status: 1,
                    createdAt: 1,
                    expiresAt: 1,
                    'requester._id': 1,
                    'requester.username': 1,
                    'requester.email': 1,
                    'requester.phone': 1,
                    'requester.profilePic': 1,
                    'requester.bloodGroup': 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            count: requests.length,
            data: requests.map(req => ({
                id: req._id,
                bloodType: req.BloodType,
                description: req.description,
                hospitalAddress: req.HospitalAddress,
                unitRequired: req.unitRequired,
                contactPhone: req.ContactPhone,
                status: req.status || 'active',
                createdAt: req.createdAt,
                expiresAt: req.expiresAt,
                requester: {
                    id: req.requester._id,
                    username: req.requester.username,
                    email: req.requester.email,
                    phone: req.requester.phone,
                    bloodGroup: req.requester.bloodGroup,
                    profilePic: req.requester.profilePic?.url || req.requester.profilePic
                }
            }))
        });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
};
export const AcceptNotification = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { userId } = req.params;
        const { RequestId } = req.body;

        // Validate inputs
        if (!userId || !RequestId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "User ID and Request ID are required"
            });
        }

        // Validate ObjectId formats
        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(RequestId)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Invalid ID format"
            });
        }

        // Find the blood request WITH session
        const bloodRequest = await RequestBlood.findById(RequestId).session(session);

        if (!bloodRequest) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: "Blood request not found"
            });
        }

        // Check if user is already a donor
        const isAlreadyDonor = bloodRequest.donations.some(donation =>
            donation.donor.toString() === userId
        );

        if (isAlreadyDonor) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "You have already accepted this donation request"
            });
        }

        // Check if self-donation
        if (bloodRequest.RequestPerson.toString() === userId) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Cannot donate to your own request"
            });
        }

        // Check if expired (add isExpired virtual or check manually)
        const now = new Date();
        if (bloodRequest.expiresAt && bloodRequest.expiresAt < now) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "This blood request has expired"
            });
        }

        // Check if already has donor
        if (bloodRequest.donations && bloodRequest.donations.length > 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "This request already has a donor"
            });
        }

        // Check request status
        if (bloodRequest.status === "Accepted") {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "This request has already been accepted"
            });
        }

        // ====================
        // UPDATE BLOOD REQUEST
        // ====================
        bloodRequest.donations.push({
            donor: userId,
            unitsDonated: bloodRequest.unitRequired,
            donatedAt: new Date()
        });

        bloodRequest.status = "Accepted";
        await bloodRequest.save({ session });

        // ====================
        // CREATE DONATION RECORD
        // ====================
        const donation = new Donation({
            donor: userId,
            request: RequestId,
            status: "scheduled",
            unitsDonated: bloodRequest.unitRequired,
            donationDate: new Date(),
            scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            notes: `Donation for ${bloodRequest.BloodType} blood at ${bloodRequest.HospitalAddress}`
        });

        await donation.save({ session });
        console.log("✅ Donation created:", donation._id);

        // ====================
        // UPDATE DONOR'S LAST DONATION DATE
        // ====================
        await User.findByIdAndUpdate(
            userId,
            { lastDonationDate: new Date() },
            { new: true, session }
        );

        // ====================
        // GET REQUESTER INFO FOR NOTIFICATION
        // ====================
        const requester = await User.findById(bloodRequest.RequestPerson)
            .select('FCMtoken username email phone')
            .session(session);

        // ====================
        // COMMIT TRANSACTION FIRST
        // ====================
        await session.commitTransaction();
        session.endSession();

        // ====================
        // SEND FCM PUSH NOTIFICATION TO REQUESTER
        // ====================
        let fcmResult = null;
        let notificationError = null;

        if (requester && requester.FCMtoken) {
            try {
                console.log("📱 Sending acceptance notification to requester:", requester.username);
                console.log("🔑 FCM Token:", requester.FCMtoken.substring(0, 20) + "...");

                // Get donor info for notification
                const donor = await User.findById(userId).select('username phone bloodGroup');

                // Prepare FCM message for REACT NATIVE
                const message = {
                    token: requester.FCMtoken,
                    notification: {
                        title: '🎉 Donor Found!',
                        body: `${donor?.username || 'Someone'} accepted your ${bloodRequest.BloodType} blood request.`
                        // REMOVE: sound and badge from here
                    },
                    data: {
                        type: 'DONATION_ACCEPTED',
                        requestId: RequestId,
                        donorId: userId,
                        donorName: donor?.username || 'Anonymous',
                        donorPhone: donor?.phone || '',
                        donorBloodType: donor?.bloodGroup || '',

                        bloodType: bloodRequest.BloodType,
                        hospital: bloodRequest.HospitalAddress,
                        unitsNeeded: bloodRequest.unitRequired.toString(),

                        // For React Native navigation
                        screen: 'RequestAccepted',
                        click_action: 'OPEN_REQUEST_ACCEPTED_SCREEN',
                        channelId: 'donation_alerts',
                        notificationType: 'donation_accepted',
                        timestamp: new Date().toISOString()
                    },
                    android: {
                        priority: 'high',
                        notification: {
                            sound: 'default', // Sound goes here for Android
                            channelId: 'donation_alerts',
                            priority: 'max',
                            click_action: 'OPEN_REQUEST_ACCEPTED_SCREEN'
                        }
                    },
                    apns: {
                        payload: {
                            aps: {
                                alert: {
                                    title: '🎉 Donor Found!',
                                    body: `Donor accepted your ${bloodRequest.BloodType} blood request.`
                                },
                                sound: 'default', // Sound goes here for iOS
                                badge: 1 // Badge goes here for iOS
                            },
                            // Extra data for iOS
                            requestId: RequestId,
                            donorId: userId,
                            screen: 'RequestAccepted'
                        }
                    }
                };

                // Send via Firebase Admin SDK
                fcmResult = await admin.messaging().send(message);
                console.log('✅ FCM notification sent to requester:', fcmResult);


            } catch (fcmError) {
                console.error('❌ FCM notification failed:', fcmError.message);
                console.error('FCM error code:', fcmError.code);
                notificationError = fcmError.message;

                // Still continue, don't fail the whole request
            }
        } else {
            console.log('⚠️ No FCM token found for requester:', bloodRequest.RequestPerson);
            notificationError = 'No FCM token for requester';
        }

        // ====================
        // POPULATE RESPONSE DATA
        // ====================
        const [populatedRequest, populatedDonation, donorInfo] = await Promise.all([
            RequestBlood.findById(RequestId)
                .populate('RequestPerson', 'username email phone bloodGroup')
                .populate('donations.donor', 'username email phone bloodGroup'),
            Donation.findById(donation._id)
                .populate('donor', 'username email phone bloodGroup')
                .populate('request', 'BloodType HospitalAddress unitRequired'),
            User.findById(userId).select('username email phone bloodGroup')
        ]);

        // ====================
        // RETURN SUCCESS RESPONSE
        // ====================
        return res.status(200).json({
            success: true,
            message: "Successfully accepted as donor",
            data: {
                request: {
                    id: populatedRequest._id,
                    bloodType: populatedRequest.BloodType,
                    hospitalAddress: populatedRequest.HospitalAddress,
                    unitRequired: populatedRequest.unitRequired,
                    status: populatedRequest.status,
                    requester: {
                        id: populatedRequest.RequestPerson._id,
                        username: populatedRequest.RequestPerson.username,
                        email: populatedRequest.RequestPerson.email,
                        phone: populatedRequest.RequestPerson.phone
                    },
                    donor: donorInfo,
                    expiresAt: populatedRequest.expiresAt,
                    createdAt: populatedRequest.createdAt
                },
                donation: {
                    id: populatedDonation._id,
                    status: populatedDonation.status,
                    unitsDonated: populatedDonation.unitsDonated,
                    scheduledDate: populatedDonation.scheduledDate,
                    donationDate: populatedDonation.donationDate,
                    donor: populatedDonation.donor,
                    request: populatedDonation.request
                },
                notification: {
                    sentToRequester: requester ? true : false,
                    fcmSent: fcmResult ? true : false,
                    fcmMessageId: fcmResult || null,
                    error: notificationError || null
                }
            }
        });

    } catch (error) {
        // ====================
        // ERROR HANDLING
        // ====================
        await session.abortTransaction();
        session.endSession();

        console.error("❌ Error in AcceptNotification:", error);

        // Handle specific Mongoose errors
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: "Invalid ID format",
                details: error.message
            });
        }

        if (error.name === 'ValidationError') {
            const errors = {};
            Object.keys(error.errors).forEach(key => {
                errors[key] = error.errors[key].message;
            });

            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: errors
            });
        }

        // Generic server error
        return res.status(500).json({
            success: false,
            message: "Server error while accepting donation",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};