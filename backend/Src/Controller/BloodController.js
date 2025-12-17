import mongoose from 'mongoose';
import axios from 'axios';
import admin from 'firebase-admin';
import { User } from '../Models/User.model.js';
import { RequestBlood } from '../Models/Request.model.js';
import { firebaseDB as db } from '../Utils/firebase.js';
import {Donation }from '../Models/donor.model.js'
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
            status: 'Looking for Blood',
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


export const getnotification= async (req, res) => {
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

    // Check if expired
    if (bloodRequest.isExpired) {
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

    // Save donation with session
    try {
      await donation.save({ session });
      console.log("✅ Donation created:", donation._id);
    } catch (donationError) {
      console.error("❌ Donation save error:", donationError);
      // Log validation errors if any
      if (donationError.errors) {
        Object.keys(donationError.errors).forEach(key => {
          console.error(`Field ${key}:`, donationError.errors[key].message);
        });
      }
      throw donationError;
    }

    // ====================
    // UPDATE DONOR'S LAST DONATION DATE
    // ====================
    await User.findByIdAndUpdate(
      userId,
      { lastDonationDate: new Date() },
      { new: true, session }
    );

    // ====================
    // CREATE NOTIFICATION RECORD
    // ====================
    let notification;
    try {
      notification = await Notification.create([{
        recipient: bloodRequest.RequestPerson,
        sender: userId,
        type: "donation_accepted",
        title: "Donor Found!",
        message: `Someone has accepted your blood request for ${bloodRequest.BloodType} type.`,
        relatedRequest: RequestId,
        read: false,
        createdAt: new Date()
      }], { session });
      
      console.log("✅ Notification created:", notification[0]?._id);
    } catch (notifError) {
      console.error("⚠️ Notification creation failed:", notifError.message);
      notification = null;
    }

    // ====================
    // COMMIT TRANSACTION
    // ====================
    await session.commitTransaction();
    session.endSession();

    // ====================
    // SEND FCM PUSH NOTIFICATION
    // ====================
    let fcmResult = null;
    try {
      // Get the recipient's FCM token from User model
      const recipientUser = await User.findById(bloodRequest.RequestPerson).select('fcmToken name');
      
      if (recipientUser && recipientUser.fcmToken) {
        console.log("📱 Sending FCM to:", recipientUser.fcmToken);
        
        // Prepare FCM message
        const message = {
          token: recipientUser.fcmToken,
          notification: {
            title: '🎉 Donor Found!',
            body: `Someone accepted your ${bloodRequest.BloodType} blood request.`,
            sound: 'default',
            badge: '1'
          },
          data: {
            type: 'DONATION_ACCEPTED',
            requestId: RequestId,
            donorId: userId,
            bloodType: bloodRequest.BloodType,
            hospital: bloodRequest.HospitalAddress,
            screen: 'RequestDetails',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            timestamp: new Date().toISOString()
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId: 'donation_alerts',
              icon: 'notification_icon',
              color: '#FF0000' // Red color for blood donation
            }
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title: '🎉 Donor Found!',
                  body: `Someone accepted your ${bloodRequest.BloodType} blood request.`
                },
                sound: 'default',
                badge: 1,
                category: 'DONATION_CATEGORY'
              }
            }
          }
        };

        // Send via Firebase Admin SDK
        fcmResult = await admin.messaging().send(message);
        console.log('✅ FCM notification sent:', fcmResult);
        
        // Update notification record with FCM status
        if (notification && notification[0]) {
          await Notification.findByIdAndUpdate(notification[0]._id, {
            fcmSent: true,
            fcmMessageId: fcmResult,
            fcmSentAt: new Date()
          });
        }
        
        // Optional: Also save to Firebase Realtime Database
        if (db) {
          const notificationRef = db.ref(`notifications/${bloodRequest.RequestPerson}/${Date.now()}`);
          await notificationRef.set({
            title: 'Donor Found!',
            body: `Someone accepted your ${bloodRequest.BloodType} blood request.`,
            requestId: RequestId,
            donorId: userId,
            type: 'donation_accepted',
            read: false,
            timestamp: new Date().toISOString()
          });
          console.log('✅ Notification saved to Firebase Realtime DB');
        }
      } else {
        console.log('⚠️ No FCM token found for recipient:', bloodRequest.RequestPerson);
      }
    } catch (fcmError) {
      console.error('❌ FCM notification failed:', fcmError.message);
      console.error('FCM error code:', fcmError.code);
      console.error('FCM error details:', fcmError.details);
      
      // Update notification record with error
      if (notification && notification[0]) {
        await Notification.findByIdAndUpdate(notification[0]._id, {
          fcmSent: false,
          fcmError: fcmError.message,
          fcmErrorCode: fcmError.code
        });
      }
      
      // Don't fail the main request if FCM fails
    }

    // ====================
    // POPULATE RESPONSE DATA
    // ====================
    // Use Promise.all for parallel population
    const [populatedRequest, populatedDonation, donorInfo, requesterInfo] = await Promise.all([
      RequestBlood.findById(RequestId)
        .populate('RequestPerson', 'name email phone')
        .populate('donations.donor', 'name email bloodType'),
      Donation.findById(donation._id)
        .populate('donor', 'name email bloodType')
        .populate('request', 'BloodType HospitalAddress'),
      User.findById(userId).select('name email phone bloodType'),
      User.findById(bloodRequest.RequestPerson).select('name email phone')
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
          requester: requesterInfo,
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
          sent: notification ? true : false,
          fcmSent: fcmResult ? true : false,
          fcmMessageId: fcmResult || null
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
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate entry",
        field: Object.keys(error.keyPattern)[0]
      });
    }
    
    // Generic server error
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};