import { firebaseDB } from "../Utils/firebase.js";
import { User } from "../Models/User.model.js";
import axios from "axios";

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
export const locationSearch = async (req, res) => {
  try {
    const { input } = req.query;

    if (!input || input.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    // 🔧 Updated URL to Google Places Autocomplete API
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json`;

    const response = await axios.get(url, {
      params: {
        // 🔑 Authentication: Replace with your Google Maps API Key
        key: process.env.GOOGLE_MAPS_API_KEY,
        // 📝 Core Search Parameters
        input: encodeURIComponent(input),
        types: 'geocode', // Use 'geocode' for addresses, 'establishment' for POIs
        // 🌍 Region & Location Biasing (for Gujarat/Maharashtra focus)
        components: 'country:in',
        location: '21.5,73.0', // Central point for bias
        radius: 300000, // Bias radius in meters (~Gujarat width)
        // 🎯 Other Parameters
        language: 'en',
      },
    });

    // 📦 Process the response - structure differs from Mapbox
    const data = response.data.predictions.map((prediction) => ({
      name: prediction.description,
      // Note: Autocomplete does not provide coordinates directly.
      // You need a separate call to the Geocoding API using the `place_id`.
      placeId: prediction.place_id,
      type: prediction.types ? prediction.types[0] : 'unknown',
    }));

    res.json({ success: true, data });

  } catch (err) {
    console.error("Google Places API error:", err.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: "Location search failed",
    });
  }
};