import { User } from "../Models/User.model.js";
import bcrypt from "bcrypt";
import { uploadOnCloudinary } from "../Utils/Cloudinary.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import mongoose from "mongoose";
import { RequestBlood } from "../Models/Request.model.js";


export const register = async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            phone,
            age,
            bloodGroup,
            gender
        } = req.body;

        if (!username || !email || !password || !phone || !age || !bloodGroup || !gender) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        if (await User.findOne({ email })) {
            return res.status(400).json({ success: false, message: "Email already exists" });
        }

        if (await User.findOne({ phone })) {
            return res.status(400).json({ success: false, message: "Phone already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let profilePic = {
            url: "https://res.cloudinary.com/demo/image/upload/v1697123456/default-user.png",
            public_id: null
        };

        if (req.file) {
            const uploaded = await uploadOnCloudinary(req.file.path, {
                folder: "blood-users"
            });

            profilePic = {
                url: uploaded.secure_url,
                public_id: uploaded.public_id
            };
        }

        const sessionId = crypto.randomBytes(32).toString("hex");

        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            phone,
            age,
            bloodGroup,
            gender,
            profilePic,
            sessionId
        });

        const token = jwt.sign(
            { userId: user._id, sessionId },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            token,
            sessionId,
            user
        });

    } catch (error) {
        console.error("REGISTER ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

export const Login = async (req, res) => {
    try {
        const { usernameOrEmail, password } = req.body;

        if (!usernameOrEmail || !password) {
            return res.status(400).json({
                success: false,
                message: "Username/Email and password are required"
            });
        }
        const user = await User.findOne({
            $or: [
                { email: usernameOrEmail },
                { username: usernameOrEmail }
            ]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Incorrect password"
            });
        }

        const sessionId = crypto.randomBytes(32).toString("hex");

        user.sessionId = sessionId;
        await user.save();

        const token = jwt.sign(
            { userId: user._id, sessionId },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            sessionId,
            user
        });

    } catch (error) {
        console.error("LOGIN ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

export const getUserData = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
        errorCode: "USER_ID_REQUIRED"
      });
    }

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
        errorCode: "INVALID_USER_ID"
      });
    }

    // Find user and exclude sensitive fields
    const user = await User.findById(userId)
      .select('-password -sessionId -__v -createdAt -updatedAt') // Exclude sensitive fields
      .lean(); // Convert to plain JS object

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        errorCode: "USER_NOT_FOUND"
      });
    }

    // Structure the response
    const userResponse = {
      _id: user._id,
      profilePic: user.profilePic || null,
      username: user.username,
      email: user.email,
      phone: user.phone,
      age: user.age,
      bloodGroup: user.bloodGroup,
      gender: user.gender,
      location: user.location || null,
      isDonor: user.isDonor || false,
      available: user.available || false
    };

    return res.status(200).json({
      success: true,
      message: "User data retrieved successfully",
      data: userResponse
    });

  } catch (error) {
    console.error("Error in getUserData:", error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
        errorCode: "INVALID_ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

export const editUserData = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    const profilePicFile = req.file; // Your multer setup will put file here

    // Validate user ID
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
        errorCode: "INVALID_ID"
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        errorCode: "USER_NOT_FOUND"
      });
    }
  

    // List of allowed fields to update
    const allowedUpdates = [
      'username',
      'email',
      'phone',
      'age',
      'bloodGroup',
      'gender',
      'location',
      'isDonor',
      'available'
    ];

    // Prepare updates object
    const filteredUpdates = {};

    // Validate and filter updates
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        // Apply specific validations
        switch (key) {
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(updates[key])) {
              return res.status(400).json({
                success: false,
                message: "Invalid email format",
                errorCode: "INVALID_EMAIL"
              });
            }
            filteredUpdates[key] = updates[key].toLowerCase().trim();
            break;

          case 'phone':
            const phoneRegex = /^[6-9]\d{9}$/;
            if (!phoneRegex.test(updates[key])) {
              return res.status(400).json({
                success: false,
                message: "Invalid phone number (10 digits, starting with 6-9)",
                errorCode: "INVALID_PHONE"
              });
            }
            filteredUpdates[key] = updates[key];
            break;

          case 'age':
            const age = parseInt(updates[key]);
            if (isNaN(age) || age < 18 || age > 100) {
              return res.status(400).json({
                success: false,
                message: "Age must be between 18 and 100",
                errorCode: "INVALID_AGE"
              });
            }
            filteredUpdates[key] = age;
            break;

          case 'bloodGroup':
            const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
            if (!validBloodGroups.includes(updates[key])) {
              return res.status(400).json({
                success: false,
                message: "Invalid blood group",
                errorCode: "INVALID_BLOOD_GROUP"
              });
            }
            filteredUpdates[key] = updates[key];
            break;

          case 'gender':
            const validGenders = ['male', 'female', 'other'];
            if (!validGenders.includes(updates[key].toLowerCase())) {
              return res.status(400).json({
                success: false,
                message: "Invalid gender",
                errorCode: "INVALID_GENDER"
              });
            }
            filteredUpdates[key] = updates[key].toLowerCase();
            break;

          case 'isDonor':
          case 'available':
            filteredUpdates[key] = updates[key] === 'true' || updates[key] === true;
            break;

          default:
            filteredUpdates[key] = updates[key];
        }
      }
    });

    // Handle location updates (if it's a string, parse it)
    if (updates.location && typeof updates.location === 'string') {
      try {
        filteredUpdates.location = JSON.parse(updates.location);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid location format",
          errorCode: "INVALID_LOCATION"
        });
      }
    }

    // Handle profile picture upload
    if (profilePicFile) {
      try {
        // Delete old profile picture from Cloudinary if exists
        if (user.profilePic && user.profilePic.public_id) {
          await uploadOnCloudinary(user.profilePic.public_id);
        }

        // Upload new profile picture to Cloudinary
        const uploadResult = await uploadOnCloudinary(profilePicFile.path, {
          folder: 'blood-users',
          width: 500,
          height: 500,
          crop: 'fill',
          quality: 'auto'
        });

        filteredUpdates.profilePic = {
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id
        };

        // Clean up local file after upload (optional)
        const fs = await import('fs');
        fs.unlink(profilePicFile.path, (err) => {
          if (err) console.error('Error deleting local file:', err);
        });

      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload profile picture",
          errorCode: "UPLOAD_FAILED"
        });
      }
    }

    // Check for duplicate email
    if (filteredUpdates.email && filteredUpdates.email !== user.email) {
      const existingUser = await User.findOne({ 
        email: filteredUpdates.email,
        _id: { $ne: userId }
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
          errorCode: "EMAIL_EXISTS"
        });
      }
    }

    // Check if there are any updates
    if (Object.keys(filteredUpdates).length === 0 && !profilePicFile) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
        errorCode: "NO_UPDATES"
      });
    }

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: filteredUpdates },
      { 
        new: true, // Return the updated document
        runValidators: true // Run mongoose validators
      }
    ).select('-password -sessionId -__v -createdAt -updatedAt');

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
      updatedFields: Object.keys(filteredUpdates),
      ...(profilePicFile && { profilePicUpdated: true })
    });

  } catch (error) {
    console.error('Error in editUserData:', error);

    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
        errorCode: "VALIDATION_ERROR"
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
        errorCode: "DUPLICATE_ENTRY"
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR"
    });
  }
};

export const logout = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
        errorCode: "INVALID_USER_ID"
      });
    }

    // Find user and clear sessionId
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: { sessionId: null }
      },
      { new: true }
    ).select('-password -__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        errorCode: "USER_NOT_FOUND"
      });
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
      data: {
        userId: user._id,
        username: user.username,
        email: user.email,
        loggedOutAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Logout error:", error);
    
    res.status(500).json({
      success: false,
      message: "Logout failed",
      errorCode: "LOGOUT_FAILED",
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

export const saveFCMToken = async (req, res) => {
  try {
    const { userId } = req.body;
    const { FCM } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    if (!FCM) {
      return res.status(400).json({
        success: false,
        message: "FCM token is required"
      });
    }

    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Update FCM token
    user.FCMtoken = FCM;
    await user.save();

    res.status(200).json({
      success: true,
      message: "FCM token saved successfully",
      data: {
        userId: user._id,
        username: user.username,
        FCMtoken: user.FCMtoken
      }
    });

  } catch (error) {
    console.error("FCM token save error:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to save FCM token",
      errorCode: "FCM_SAVE_ERROR"
    });
  }
};

export const toggleDonorStatus = async (req, res) => {
  try {
    const { userId, isDonor } = req.body;
    
    // Validate input
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required"
      });
    }
    
    if (typeof isDonor !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: "isDonor must be a boolean (true/false)"
      });
    }
    
    // Find and update the user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { isDonor: isDonor } },
      { new: true, runValidators: true }
    ).select('_id username isDonor bloodGroup phone');
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }
    
  
    
    res.status(200).json({
      success: true,
      message: `User ${isDonor ? 'marked as' : 'removed as'} donor`,
      data: {
        user: updatedUser,
        status: isDonor ? '✅ Now a donor' : '❌ Not a donor',
        canReceiveNotifications: isDonor ? 'Yes (with FCM token)' : 'No'
      }
    });
    
  } catch (error) {
    console.error("Error toggling donor status:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};


export const getYourRequest = async (req, res) => {
  try {
    // Extract userId from request body
    const { userId } = req.body;
    
    // Validate userId exists
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Validate userId format (optional but recommended for MongoDB ObjectId)
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID format",
      });
    }

    // Convert string to ObjectId for querying
    const objectId = new mongoose.Types.ObjectId(userId);

    const requests = await RequestBlood.find({
      RequestPerson: objectId,
    })
      .sort({ createdAt: -1 }); // latest first

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });

  } catch (error) {
    console.error("Error fetching user requests:", error);
    
    // Handle specific mongoose errors
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID format",
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};