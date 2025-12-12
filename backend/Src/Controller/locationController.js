import { firebaseDB } from "../Utils/firebase.js";
import { User } from "../Models/User.model.js";
import axios from 'axios';
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



const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Cache for Gujarat addresses (5 minutes)
const gujaratCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

export const autocompleteGujaratAddress = async (req, res) => {
    try {
        const { input } = req.body;
        
        if (!input || input.trim().length < 2) {
            return res.json({
                success: true,
                predictions: [],
                message: 'Please enter at least 2 characters'
            });
        }
        
        const searchTerm = input.trim();
        console.log(`📍 Gujarat autocomplete search: "${searchTerm}"`);
        
        // Check cache first
        const cacheKey = `gujarat_${searchTerm}`;
        const cachedResult = gujaratCache.get(cacheKey);
        
        if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_DURATION) {
            console.log('📦 Returning cached Gujarat results');
            return res.json({
                success: true,
                predictions: cachedResult.predictions
            });
        }
        
        // Google Places API call RESTRICTED to Gujarat, India
        const params = {
            input: searchTerm,
            key: GOOGLE_MAPS_API_KEY,
            components: 'country:in|administrative_area:GJ', // Gujarat, India
            language: 'en',
            types: 'address|establishment', // Addresses and places
            location: '22.2587,71.1924', // Center of Gujarat
            radius: 300000, // 300km radius covering entire Gujarat
            strictbounds: true // Strictly within radius
        };
        
        const response = await axios.get(
            'https://maps.googleapis.com/maps/api/place/autocomplete/json',
            { params, timeout: 5000 }
        );
        
        if (response.data.status === 'OK') {
            // Filter to ensure only Gujarat results
            const gujaratPredictions = response.data.predictions
                .filter(prediction => {
                    // Double-check if description contains Gujarat cities
                    const description = prediction.description.toLowerCase();
                    const gujaratCities = [
                        'ahmedabad', 'surat', 'vadodara', 'rajkot', 'bhavnagar',
                        'jamnagar', 'gandhinagar', 'nadiad', 'anand', 'mehsana',
                        'morbi', 'bharuch', 'veraval', 'navsari', 'valsad',
                        'porbandar', 'godhra', 'palanpur', 'himmatnagar',
                        'gujarat', 'guj', 'gj'
                    ];
                    
                    return gujaratCities.some(city => description.includes(city));
                })
                .map(prediction => ({
                    place_id: prediction.place_id,
                    description: prediction.description,
                    main_text: prediction.structured_formatting?.main_text || '',
                    secondary_text: prediction.structured_formatting?.secondary_text || '',
                    types: prediction.types
                }));
            
            console.log(`✅ Found ${gujaratPredictions.length} Gujarat addresses`);
            
            // Cache the filtered results
            gujaratCache.set(cacheKey, {
                predictions: gujaratPredictions,
                timestamp: Date.now()
            });
            
            // Manage cache size
            if (gujaratCache.size > 50) {
                const firstKey = gujaratCache.keys().next().value;
                gujaratCache.delete(firstKey);
            }
            
            res.json({
                success: true,
                predictions: gujaratPredictions,
                count: gujaratPredictions.length
            });
            
        } else if (response.data.status === 'ZERO_RESULTS') {
            res.json({
                success: true,
                predictions: [],
                message: 'No addresses found in Gujarat'
            });
        } else {
            console.error('❌ Google API error:', response.data.status);
            res.status(500).json({
                success: false,
                error: 'Address service unavailable'
            });
        }
        
    } catch (error) {
        console.error('❌ Gujarat autocomplete error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch addresses'
        });
    }
};
