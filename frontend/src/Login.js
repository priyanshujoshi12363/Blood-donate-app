import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage keys
const STORAGE_KEYS = {
  TOKEN: '@auth_token',
  SESSION_ID: '@session_id',
  USER_ID: '@user_id',
  USER_DATA: '@user_data',
  IS_LOGGED_IN: '@is_logged_in'
};

export default function Login({ navigation }) {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [checkingStorage, setCheckingStorage] = useState(true);

  // Check if user is already logged in on app start
  useEffect(() => {
    checkExistingLogin();
  }, []);

  const checkExistingLogin = async () => {
    try {
      const isLoggedIn = await AsyncStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN);
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      const userId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);

      // If user is logged in and has valid token, navigate to Home
      if (isLoggedIn === 'true' && token && userId) {
        // Optional: Validate token with backend
        const isValid = await validateToken(token);
        if (isValid) {
          navigation.replace('Main');
        } else {
          // Token expired, clear storage
          await clearStorage();
        }
      }
    } catch (error) {
      console.error('Error checking login status:', error);
    } finally {
      setCheckingStorage(false);
    }
  };

  const validateToken = async (token) => {
    try {
      // You can add a token validation API call here
      // For now, we'll just check if token exists
      return !!token;
    } catch (error) {
      return false;
    }
  };

  const clearStorage = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.SESSION_ID,
        STORAGE_KEYS.USER_ID,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.IS_LOGGED_IN
      ]);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!emailOrUsername.trim()) {
      newErrors.emailOrUsername = 'Email or username is required';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // Call your backend API
      const response = await fetch('https://blood-donate-app-9c09.onrender.com/user/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usernameOrEmail: emailOrUsername,
          password: password
        })
      });

      const data = await response.json();

      if (data.success) {
        // Save all data to AsyncStorage
        await saveLoginData(data);
        
        Alert.alert(
          'Login Successful',
          `Welcome back, ${data.user.username}!`,
          [{ text: 'OK', onPress: () => navigation.replace('Main') }]
        );
      } else {
        Alert.alert(
          'Login Failed',
          data.message || 'Invalid credentials. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert(
        'Login Failed',
        'Network error. Please check your connection.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const saveLoginData = async (data) => {
    try {
      // Store all data in AsyncStorage
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.TOKEN, data.token],
        [STORAGE_KEYS.SESSION_ID, data.sessionId],
        [STORAGE_KEYS.USER_ID, data.user._id],
        [STORAGE_KEYS.USER_DATA, JSON.stringify(data.user)],
        [STORAGE_KEYS.IS_LOGGED_IN, 'true']
      ]);

      // Also store individual fields for easy access
      const userInfo = {
        username: data.user.username,
        email: data.user.email,
        phone: data.user.phone,
        bloodGroup: data.user.bloodGroup,
        isDonor: data.user.isDonor,
        profilePic: data.user.profilePic?.url || null
      };

      await AsyncStorage.setItem('@user_info', JSON.stringify(userInfo));
      
      console.log('Login data saved successfully');
    } catch (error) {
      console.error('Error saving login data:', error);
      throw error;
    }
  };

  // Helper function to get stored data (you can use this in other screens)
  const getStoredData = async () => {
    try {
      const [
        token,
        sessionId,
        userId,
        userData,
        isLoggedIn
      ] = await AsyncStorage.multiGet([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.SESSION_ID,
        STORAGE_KEYS.USER_ID,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.IS_LOGGED_IN
      ]);

      return {
        token: token[1],
        sessionId: sessionId[1],
        userId: userId[1],
        userData: userData[1] ? JSON.parse(userData[1]) : null,
        isLoggedIn: isLoggedIn[1] === 'true'
      };
    } catch (error) {
      console.error('Error getting stored data:', error);
      return null;
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Reset Password',
      'Please enter your email to reset password.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send', 
          onPress: () => {
            Alert.alert('Success', 'Password reset link sent to your email');
          }
        },
      ]
    );
  };

  // Show loading while checking storage
  if (checkingStorage) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#E53935" />
        <Text style={styles.loadingText}>Checking login status...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header with Image */}
          <View style={styles.header}>
            <Image 
              source={require('../assets/main.jpeg')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.appTitle}>Rapid donor</Text>
            <Text style={styles.subtitle}>Life is in your blood</Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            <Text style={styles.loginTitle}>Sign In</Text>
            <Text style={styles.loginSubtitle}>Donate blood, save lives</Text>
            
            {/* Email/Username Input */}
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons 
                name="account-outline" 
                size={24} 
                color="#666" 
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, errors.emailOrUsername && styles.inputError]}
                placeholder="Email or Username"
                placeholderTextColor="#999"
                value={emailOrUsername}
                onChangeText={(text) => {
                  setEmailOrUsername(text);
                  if (errors.emailOrUsername) {
                    setErrors({...errors, emailOrUsername: ''});
                  }
                }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            {errors.emailOrUsername && (
              <Text style={styles.errorText}>{errors.emailOrUsername}</Text>
            )}

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons 
                name="lock-outline" 
                size={24} 
                color="#666" 
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) {
                    setErrors({...errors, password: ''});
                  }
                }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <MaterialCommunityIcons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={24} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons 
                    name="login" 
                    size={24} 
                    color="#fff" 
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.loginButtonText}>Sign In</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>New donor? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By signing in, you agree to our Terms & Privacy Policy
            </Text>
            <Text style={styles.footerNote}>
              Your donation can save up to 3 lives
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Export the storage helper for use in other components
export const getAuthData = async () => {
  try {
    const [
      token,
      userId,
      userData
    ] = await AsyncStorage.multiGet([
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.USER_ID,
      STORAGE_KEYS.USER_DATA
    ]);

    return {
      token: token[1],
      userId: userId[1],
      userData: userData[1] ? JSON.parse(userData[1]) : null,
      isAuthenticated: !!token[1]
    };
  } catch (error) {
    console.error('Error getting auth data:', error);
    return { isAuthenticated: false };
  }
};

// Logout function for other screens
export const logoutUser = async (navigation) => {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.SESSION_ID,
      STORAGE_KEYS.USER_ID,
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.IS_LOGGED_IN,
      '@user_info'
    ]);
    
    if (navigation) {
      navigation.replace('Login');
    }
  } catch (error) {
    console.error('Logout error:', error);
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 2,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#E53935',
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#E53935',
    marginTop: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  loginSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  inputIcon: {
    padding: 15,
  },
  input: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  inputError: {
    borderColor: '#E53935',
    borderWidth: 2,
  },
  eyeIcon: {
    padding: 15,
  },
  errorText: {
    color: '#E53935',
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 5,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 25,
  },
  forgotPasswordText: {
    color: '#E53935',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#E53935',
    borderRadius: 10,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginRight: 10,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    color: '#666',
    fontSize: 16,
  },
  registerLink: {
    color: '#E53935',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  footerText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  footerNote: {
    color: '#E53935',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    color: '#666',
    fontSize: 16,
  },
});