// services/fcmService.js - UPDATED FOR DEVELOPMENT CLIENT
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BACKEND_URL = 'https://blood-donate-app-9c09.onrender.com';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class FCMService {
  // Get NATIVE device token (FCM for Android, APNs for iOS)
  async getDeviceToken() {
    try {
      console.log('🔑 Getting NATIVE device token for Development Client...');
      
      // Request permissions first
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ Notification permission denied');
        return null;
      }
      
      // Get NATIVE device push token (only works in development/standalone builds)
      const tokenData = await Notifications.getDevicePushTokenAsync();
      const deviceToken = tokenData.data;
      
      console.log('✅ NATIVE Device Token obtained:', deviceToken.substring(0, 30) + '...');
      console.log('📱 Platform:', Platform.OS);
      console.log('🔧 Token type:', tokenData.type);
      
      return deviceToken;
      
    } catch (error) {
      console.error('💥 Error getting native device token:', error);
      
      // Fallback for Expo Go or if native module fails
      if (error.message.includes('ExpoPushTokenManager') || error.message.includes('native module')) {
        console.log('⚠️ Native module not available, using Expo push token as fallback');
        try {
          const expoTokenData = await Notifications.getExpoPushTokenAsync();
          console.log('🔄 Using Expo push token fallback');
          return expoTokenData.data;
        } catch (expoError) {
          console.error('💥 Expo token fallback also failed:', expoError);
        }
      }
      
      return null;
    }
  }
  
  // Send token to backend - EXACTLY AS YOUR API EXPECTS
  async sendTokenToBackend(userId, deviceToken) {
    try {
      // Don't send if token is null
      if (!deviceToken) {
        console.log('❌ No device token to send');
        return { success: false, error: 'No device token' };
      }
      
      console.log('📤 Sending NATIVE token to:', `${BACKEND_URL}/user/FCM`);
      console.log('👤 User ID:', userId);
      console.log('🔑 Token (first 20 chars):', deviceToken.substring(0, 20));
      
      const payload = {
        userId: userId,
        FCM: deviceToken
      };
      
      console.log('📦 Payload:', JSON.stringify(payload));
      
      const response = await fetch(`${BACKEND_URL}/user/FCM`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
      });
      
      console.log('📡 Response status:', response.status);
      
      const responseText = await response.text();
      console.log('📡 Response body:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.log('⚠️ Response is not JSON:', responseText);
        result = { message: responseText };
      }
      
      if (response.ok) {
        console.log('🎯 NATIVE token sent successfully! Server response:', result);
        return { success: true, data: result };
      } else {
        console.log('❌ Backend error:', result);
        return { success: false, error: result.message || 'Unknown error' };
      }
      
    } catch (error) {
      console.error('💥 Network error sending token:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Main function to get and send token
  async initializeForUser(userId) {
    try {
      console.log('🚀 Initializing FCM with NATIVE tokens for user:', userId);
      
      // Check if token already sent for this user
      const lastSentUserId = await AsyncStorage.getItem('@last_fcm_user');
      const lastSentToken = await AsyncStorage.getItem('@last_fcm_token');
      
      if (lastSentUserId === userId && lastSentToken) {
        console.log('✅ Token already sent for this user');
        return { success: true, alreadySent: true };
      }
      
      // Get NATIVE device token
      console.log('📱 Getting NATIVE device token...');
      const deviceToken = await this.getDeviceToken();
      
      if (!deviceToken) {
        console.log('❌ Failed to get device token');
        return { success: false, error: 'Failed to get device token' };
      }
      
      console.log('✅ Got token, sending to backend...');
      
      // Send to backend
      const sendResult = await this.sendTokenToBackend(userId, deviceToken);
      
      if (sendResult.success) {
        // Store successful send
        await AsyncStorage.setItem('@last_fcm_user', userId);
        await AsyncStorage.getItem('@last_fcm_token', deviceToken);
        await AsyncStorage.setItem('@fcm_sent', 'true');
        await AsyncStorage.setItem('@fcm_token_type', 'native');
        
        console.log('🎯 FCM setup complete with NATIVE token');
        return { success: true, token: deviceToken, isNative: true };
      } else {
        console.log('❌ Failed to send token:', sendResult.error);
        return sendResult;
      }
      
    } catch (error) {
      console.error('💥 FCM initialization error:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Reset FCM data
  async resetFCMData() {
    await AsyncStorage.multiRemove([
      '@last_fcm_user',
      '@last_fcm_token',
      '@fcm_sent',
      '@fcm_token_type'
    ]);
    console.log('🔄 FCM data reset');
  }
  
  // Get current FCM status
  async getFCMStatus() {
    const [sent, token, userId, tokenType] = await Promise.all([
      AsyncStorage.getItem('@fcm_sent'),
      AsyncStorage.getItem('@last_fcm_token'),
      AsyncStorage.getItem('@last_fcm_user'),
      AsyncStorage.getItem('@fcm_token_type')
    ]);
    
    return {
      sent: sent === 'true',
      token: token,
      userId: userId,
      tokenType: tokenType || 'unknown'
    };
  }
  
  // DEBUG: Test token functions
  async debugTokenFunctions() {
    try {
      console.log('🔧 DEBUG: Testing token functions...');
      
      // Test permissions
      const permissions = await Notifications.getPermissionsAsync();
      console.log('📋 Permissions:', permissions);
      
      // Try native token
      try {
        const nativeToken = await Notifications.getDevicePushTokenAsync();
        console.log('✅ Native token available:', nativeToken.data.substring(0, 30) + '...');
        console.log('📱 Native token type:', nativeToken.type);
      } catch (nativeError) {
        console.log('❌ Native token failed:', nativeError.message);
      }
      
      // Try Expo token
      try {
        const expoToken = await Notifications.getExpoPushTokenAsync();
        console.log('✅ Expo token available:', expoToken.data.substring(0, 30) + '...');
      } catch (expoError) {
        console.log('❌ Expo token failed:', expoError.message);
      }
      
    } catch (error) {
      console.error('💥 Debug error:', error);
    }
  }
}

// Create singleton instance
const fcmServiceInstance = new FCMService();
export default fcmServiceInstance;