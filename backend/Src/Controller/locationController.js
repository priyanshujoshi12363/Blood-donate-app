import { firebaseDB } from "../Utils/firebase.js";
import { User } from "../Models/User.model.js";

export const saveLocation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { latitude, longitude } = req.body;

    // Basic validation
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required"
      });
    }

    // Convert to numbers
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // Check if Firebase is available
    if (!firebaseDB) {
      return res.status(500).json({
        success: false,
        message: "Firebase not connected"
      });
    }

    // Save to Firebase
    await firebaseDB.ref(`userLocations/${userId}`).set({
      latitude: lat,
      longitude: lng,
      timestamp: Date.now()
    });

    // Save to MongoDB - match your exact schema structure
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'location.type': "Point",  // Set the nested type field
          'location.coordinates': [lat , lng]  // Set coordinates array
        }
      },
      { 
        new: true,
        runValidators: true  // Validate against your schema
      }
    ).select('-password -sessionId -__v');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found in MongoDB"
      });
    }

    res.status(200).json({
      success: true,
      message: "Location saved to Firebase and MongoDB",
      data: {
        userId: userId,
        latitude: lat,
        longitude: lng,
        mongodbLocation: updatedUser.location
      }
    });

  } catch (error) {
    console.error("Error saving location:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Location validation failed",
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to save location"
    });
  }
};