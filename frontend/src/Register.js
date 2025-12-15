import React, { useState } from 'react';
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
  ScrollView,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

const STORAGE_KEYS = {
  TOKEN: '@auth_token',
  SESSION_ID: '@session_id',
  USER_ID: '@user_id',
  USER_DATA: '@user_data',
  IS_LOGGED_IN: '@is_logged_in'
};

export default function Register({ navigation }) {
  // Form states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [bloodGroup, setBloodGroup] = useState('A+');
  const [gender, setGender] = useState('male');
  const [profilePic, setProfilePic] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Blood group options
  const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  
  // Gender options
  const genders = ["male", "female", "other"];

  // Function to pick profile picture
  const pickProfilePicture = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to upload profile picture.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setProfilePic(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Function to take photo with camera
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera permissions to take a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setProfilePic(result.assets[0]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Username validation
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else if (username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    // Email validation
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Password validation
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    // Confirm password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    // Phone validation
    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(phone)) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
    }
    
    // Age validation
    if (!age.trim()) {
      newErrors.age = 'Age is required';
    } else {
      const ageNum = parseInt(age);
      if (isNaN(ageNum) || ageNum < 18 || ageNum > 65) {
        newErrors.age = 'Age must be between 18 and 65 to donate blood';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // Prepare FormData for multipart/form-data
      const formData = new FormData();
      
      // Add all text fields to formData
      formData.append('username', username.trim());
      formData.append('email', email.trim().toLowerCase());
      formData.append('password', password);
      formData.append('phone', phone.trim());
      formData.append('age', age);
      formData.append('bloodGroup', bloodGroup);
      formData.append('gender', gender);
      
      // Add profile picture if selected
      if (profilePic) {
        const filename = profilePic.uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        
        formData.append('profile_pic', {
          uri: profilePic.uri,
          type: type,
          name: filename
        });
      } else {
        // Add empty file field if no picture
        formData.append('profile_pic', '');
      }

      // Your backend API endpoint
      const API_URL = 'https://blood-donate-app-9c09.onrender.com/user/register';
      
      console.log('Sending registration request...');
      
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          // Don't set Content-Type header - let React Native set it with boundary
        },
        body: formData,
      });

      const data = await response.json();
      console.log('Registration response:', data);

      if (data.success) {
        // Save all data to AsyncStorage (same as login)
        await saveRegistrationData(data);
        
        Alert.alert(
          'Registration Successful! 🎉',
          `Welcome ${data.user.username}! You are now a Rapid Donor member.`,
          [
            {
              text: 'Continue to Home',
              onPress: () => {
                navigation.replace('Home');
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Registration Failed',
          data.message || 'Something went wrong. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert(
        'Registration Error',
        error.message || 'Unable to connect to server. Please check your connection.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const saveRegistrationData = async (data) => {
    try {
      // Store all data in AsyncStorage (same as login screen)
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
        gender: data.user.gender,
        age: data.user.age,
        isDonor: data.user.isDonor,
        profilePic: data.user.profilePic?.url || null,
        location: data.user.location
      };

      await AsyncStorage.setItem('@user_info', JSON.stringify(userInfo));
      
      console.log('Registration data saved to AsyncStorage');
      console.log('User ID:', data.user._id);
      console.log('Token saved:', data.token ? 'Yes' : 'No');
      
    } catch (error) {
      console.error('Error saving registration data:', error);
      throw error;
    }
  };

  const handleBackToLogin = () => {
    navigation.navigate('Login');
  };

  // Function to clear error for a specific field
  const clearError = (fieldName) => {
    if (errors[fieldName]) {
      setErrors({...errors, [fieldName]: ''});
    }
  };

  // Function to show profile picture options
  const showProfilePicOptions = () => {
    Alert.alert(
      'Profile Picture',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickProfilePicture },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Debug function to check FormData
  const debugFormData = () => {
    const formData = new FormData();
    formData.append('username', username.trim());
    formData.append('email', email.trim().toLowerCase());
    formData.append('password', password);
    formData.append('phone', phone.trim());
    formData.append('age', age);
    formData.append('bloodGroup', bloodGroup);
    formData.append('gender', gender);
    
    if (profilePic) {
      const filename = profilePic.uri.split('/').pop();
      formData.append('profile_pic', {
        uri: profilePic.uri,
        type: 'image/jpeg',
        name: filename
      });
    }
    
    console.log('FormData preview:');
    console.log('Username:', username);
    console.log('Email:', email);
    console.log('Phone:', phone);
    console.log('Age:', age);
    console.log('Blood Group:', bloodGroup);
    console.log('Gender:', gender);
    console.log('Has Profile Pic:', !!profilePic);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Image 
                source={require('../assets/main.jpeg')} 
                style={styles.headerImage}
                resizeMode="contain"
              />
              <Text style={styles.appTitle}>Join Rapid Donor</Text>
              <Text style={styles.subtitle}>Be a hero, save lives</Text>
            </View>

            {/* Profile Picture Upload */}
            <View style={styles.profileSection}>
              <Text style={styles.sectionTitle}>Profile Picture (Optional)</Text>
              <TouchableOpacity 
                style={styles.profilePicContainer}
                onPress={showProfilePicOptions}
              >
                {profilePic ? (
                  <Image 
                    source={{ uri: profilePic.uri }} 
                    style={styles.profilePic}
                  />
                ) : (
                  <View style={styles.profilePlaceholder}>
                    <MaterialCommunityIcons 
                      name="camera-plus" 
                      size={50} 
                      color="#666" 
                    />
                    <Text style={styles.profilePlaceholderText}>Add Photo</Text>
                  </View>
                )}
                <View style={styles.profilePicOverlay}>
                  <MaterialCommunityIcons 
                    name="camera" 
                    size={24} 
                    color="#fff" 
                  />
                </View>
              </TouchableOpacity>
              <Text style={styles.profileHelpText}>
                Tap to add a profile picture (Optional)
              </Text>
            </View>

            {/* Registration Form */}
            <View style={styles.formContainer}>
              <Text style={styles.registerTitle}>Create Account</Text>
              <Text style={styles.registerSubtitle}>Fill in your details to register</Text>

              {/* Username */}
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons 
                  name="account-outline" 
                  size={24} 
                  color="#666" 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, errors.username && styles.inputError]}
                  placeholder="Username"
                  placeholderTextColor="#999"
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    clearError('username');
                  }}
                  autoCapitalize="none"
                />
              </View>
              {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}

              {/* Email */}
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons 
                  name="email-outline" 
                  size={24} 
                  color="#666" 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="Email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    clearError('email');
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

              {/* Password */}
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons 
                  name="lock-outline" 
                  size={24} 
                  color="#666" 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  placeholder="Password (min. 6 characters)"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    clearError('password');
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
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons 
                  name="lock-check-outline" 
                  size={24} 
                  color="#666" 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, errors.confirmPassword && styles.inputError]}
                  placeholder="Confirm Password"
                  placeholderTextColor="#999"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    clearError('confirmPassword');
                  }}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                >
                  <MaterialCommunityIcons 
                    name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                    size={24} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}

              {/* Phone Number */}
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons 
                  name="phone-outline" 
                  size={24} 
                  color="#666" 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, errors.phone && styles.inputError]}
                  placeholder="Phone Number (10 digits)"
                  placeholderTextColor="#999"
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    clearError('phone');
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

              {/* Age */}
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons 
                  name="cake-variant-outline" 
                  size={24} 
                  color="#666" 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, errors.age && styles.inputError]}
                  placeholder="Age (18-65)"
                  placeholderTextColor="#999"
                  value={age}
                  onChangeText={(text) => {
                    setAge(text);
                    clearError('age');
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
              {errors.age && <Text style={styles.errorText}>{errors.age}</Text>}

              {/* Blood Group Dropdown */}
              <View style={styles.pickerContainer}>
                <MaterialCommunityIcons 
                  name="water" 
                  size={24} 
                  color="#666" 
                  style={styles.inputIcon}
                />
                <View style={styles.pickerWrapper}>
                  <Text style={styles.pickerLabel}>Blood Group:</Text>
                  <Picker
                    selectedValue={bloodGroup}
                    onValueChange={(itemValue) => setBloodGroup(itemValue)}
                    style={styles.picker}
                  >
                    {bloodGroups.map((group) => (
                      <Picker.Item key={group} label={group} value={group} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Gender Dropdown */}
              <View style={styles.pickerContainer}>
                <MaterialCommunityIcons 
                  name="gender-male-female" 
                  size={24} 
                  color="#666" 
                  style={styles.inputIcon}
                />
                <View style={styles.pickerWrapper}>
                  <Text style={styles.pickerLabel}>Gender:</Text>
                  <Picker
                    selectedValue={gender}
                    onValueChange={(itemValue) => setGender(itemValue)}
                    style={styles.picker}
                  >
                    {genders.map((gen) => (
                      <Picker.Item 
                        key={gen} 
                        label={gen.charAt(0).toUpperCase() + gen.slice(1)} 
                        value={gen} 
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Debug Button (optional - remove in production) */}
              {/* <TouchableOpacity
                style={[styles.debugButton]}
                onPress={debugFormData}
              >
                <Text style={styles.debugButtonText}>Debug Form Data</Text>
              </TouchableOpacity> */}

              {/* Register Button */}
              <TouchableOpacity
                style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons 
                      name="account-plus" 
                      size={24} 
                      color="#fff" 
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.registerButtonText}>
                      {isLoading ? 'Registering...' : 'Register Now'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Terms */}
              <Text style={styles.termsText}>
                By registering, you agree to our Terms & Privacy Policy. You must be at least 18 years old to donate blood.
              </Text>

              {/* Login Link */}
              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <TouchableOpacity onPress={handleBackToLogin}>
                  <Text style={styles.loginLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  header: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  headerImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#E53935',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E53935',
    marginTop: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  profilePicContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  profilePic: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#E53935',
  },
  profilePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  profilePlaceholderText: {
    marginTop: 5,
    color: '#666',
    fontSize: 14,
  },
  profilePicOverlay: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#E53935',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  profileHelpText: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
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
    marginBottom: 30,
  },
  registerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  registerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 25,
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
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 5,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
    paddingRight: 10,
  },
  pickerWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 16,
    color: '#333',
    marginRight: 10,
    paddingLeft: 10,
  },
  picker: {
    flex: 1,
    height: 50,
  },
  debugButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  registerButton: {
    backgroundColor: '#E53935',
    borderRadius: 10,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 20,
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginRight: 10,
  },
  termsText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#E53935',
    fontSize: 14,
    fontWeight: 'bold',
  },
});