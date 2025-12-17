import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'https://blood-donate-app-9c09.onrender.com';

class FCMService {

  // 🔹 Get logged-in userId
  async getUserId() {
    const userStr = await AsyncStorage.getItem('@user_data');
    if (!userStr) return null;
    return JSON.parse(userStr)._id;
  }

  // 🔹 Request notification permission
  async requestPermission() {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  // 🔹 Get FCM token
  async getToken() {
    let token = await AsyncStorage.getItem('fcm_token');
    if (token) return token;

    const allowed = await this.requestPermission();
    if (!allowed) return null;

    token = await messaging().getToken();
    if (token) {
      await AsyncStorage.setItem('fcm_token', token);
    }
    return token;
  }

  // 🔹 Send token to backend (ONLY ONCE)
  async sendTokenToBackend() {
    const alreadySent = await AsyncStorage.getItem('fcm_sent');
    if (alreadySent) return;

    const userId = await this.getUserId();
    if (!userId) return;

    const token = await this.getToken();
    if (!token) return;

    await fetch(`${BACKEND_URL}/user/FCM`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        FCM: token,
      }),
    });

    await AsyncStorage.setItem('fcm_sent', 'true');
  }

  // 🔹 Handle token refresh
  listenTokenRefresh() {
    messaging().onTokenRefresh(async newToken => {
      await AsyncStorage.setItem('fcm_token', newToken);
      await AsyncStorage.removeItem('fcm_sent'); // force re-send
      await this.sendTokenToBackend();
    });
  }

  // 🔹 Call this from HomeScreen
  async init() {
    await this.sendTokenToBackend();
    this.listenTokenRefresh();
  }
}

export default new FCMService();
