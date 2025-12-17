import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from "react-native";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from '@react-native-async-storage/async-storage';
import fcmServiceInstance from "../fcmService";
// AsyncStorage keys
const STORAGE_KEYS = {
  TOKEN: '@auth_token',
  SESSION_ID: '@session_id',
  USER_ID: '@user_id',
  USER_DATA: '@user_data',
  IS_LOGGED_IN: '@is_logged_in',
  LAST_DONOR_UPDATE: '@last_donor_update'
};

// MOCK REQUESTS DATA
const MOCK_REQUESTS = [
  { 
    id: "1", 
    name: "Rahul Patil", 
    blood: "O+", 
    distance: "3.2 km",
    urgency: "high",
    hospital: "City Hospital",
    time: "2 hours ago"
  },
  { 
    id: "2", 
    name: "Sneha Joshi", 
    blood: "A-", 
    distance: "6.5 km",
    urgency: "medium",
    hospital: "Green Valley Medical",
    time: "4 hours ago"
  },
  { 
    id: "3", 
    name: "Amit Kulkarni", 
    blood: "B+", 
    distance: "9.1 km",
    urgency: "low",
    hospital: "Sunrise Hospital",
    time: "6 hours ago"
  },
];

// Add the missing functions that your UI expects
const getUrgencyColor = (urgency) => {
  switch(urgency) {
    case 'high': return '#ff4757';
    case 'medium': return '#ffa502';
    case 'low': return '#2ed573';
    default: return '#2ed573';
  }
};

const getUrgencyText = (urgency) => {
  switch(urgency) {
    case 'high': return 'Urgent';
    case 'medium': return 'Moderate';
    case 'low': return 'Normal';
    default: return 'Normal';
  }
};

export default function Home({ navigation }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("blood");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [nextUpdateDate, setNextUpdateDate] = useState('');
  const [isUpdatingDonor, setIsUpdatingDonor] = useState(false);
  const [fcmStatus, setFcmStatus] = useState({ 
    sent: false, 
    loading: false, 
    message: '' 
  });
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 375;

  // ==================== FCM AUTOMATIC INITIALIZATION ====================
  useEffect(() => {
    const initializeFCM = async () => {
      try {
        console.log('🚀 Home mounted - initializing FCM...');
        setFcmStatus(prev => ({ ...prev, loading: true }));
        
        // Wait for user data to load first
        const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
        if (!userStr) {
          console.log('⏳ Waiting for user data...');
          setTimeout(initializeFCM, 1000); // Retry in 1 second
          return;
        }
        
        const userData = JSON.parse(userStr);
        const userId = userData._id || userData.id;
        
        if (!userId) {
          console.log('❌ No user ID found');
          setFcmStatus({ sent: false, loading: false, message: 'No user ID' });
          return;
        }
        
        console.log('✅ User ID found:', userId);
        
        // Initialize FCM for this user
        const result = await fcmServiceInstance.initializeForUser(userId);
        
        if (result.success) {
          if (result.alreadySent) {
            console.log('📱 FCM token already sent for this user');
            setFcmStatus({ 
              sent: true, 
              loading: false, 
              message: 'Token already registered' 
            });
          } else {
            console.log('🎯 FCM token sent successfully!');
            setFcmStatus({ 
              sent: true, 
              loading: false, 
              message: 'Token sent successfully' 
            });
          }
        } else {
          console.log('❌ FCM initialization failed:', result.error);
          setFcmStatus({ 
            sent: false, 
            loading: false, 
            message: result.error || 'Failed to send token' 
          });
        }
        
      } catch (error) {
        console.error('💥 FCM initialization error:', error);
        setFcmStatus({ 
          sent: false, 
          loading: false, 
          message: error.message 
        });
      }
    };
    
    // Start FCM initialization
    initializeFCM();
  }, []);

  // Fetch live user data from API
  const fetchLiveUserData = async () => {
    try {
      setIsFetchingData(true);
      
      // Get user ID and token from AsyncStorage
      const [userId, token] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER_ID),
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN)
      ]);

      if (!userId || !token) {
        console.log('❌ Missing credentials for API call');
        return null;
      }

      console.log(`🔄 Fetching live data for user: ${userId}`);
      
      // Make API call to get live user data
      const response = await fetch(`https://blood-donate-app-9c09.onrender.com/user/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      const result = await response.json();
      console.log('📡 Live API response:', result);

      if (result.success) {
        // Update local storage with fresh data
        await AsyncStorage.setItem('@user_data', JSON.stringify(result.data));
        return result.data;
      } else {
        console.log('❌ API error:', result.message);
        return null;
      }
      
    } catch (error) {
      console.error('❌ Error fetching live data:', error);
      return null;
    } finally {
      setIsFetchingData(false);
    }
  };

  // Load user data - tries live API first, falls back to local storage
  const loadUserData = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      
      let userData = null;
      
      // Try to fetch live data first
      const liveData = await fetchLiveUserData();
      
      if (liveData) {
        // Use live data from API
        userData = liveData;
        console.log('✅ Using live API data');
      } else {
        // Fall back to local storage
        const userDataStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
        if (userDataStr) {
          userData = JSON.parse(userDataStr);
          console.log('📂 Using local storage data (fallback)');
        } else {
          console.warn('❌ No user data found anywhere');
        }
      }
      
      if (userData) {
        setUserData(userData);
        
        // Check if we need to update donor status
        await checkAndUpdateDonorStatus(userData._id);
      } else {
        Alert.alert(
          "Session Expired",
          "Please login again",
          [{ text: "OK", onPress: () => navigation.replace('Login') }]
        );
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert(
        "Error",
        "Failed to load user data",
        [{ text: "OK", onPress: () => navigation.replace('Login') }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // AUTO DONOR STATUS UPDATE FUNCTION
  const checkAndUpdateDonorStatus = async (userId) => {
    try {
      console.log('🔍 Checking donor status update...');
      
      // Get token
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);

      if (!userId || !token) {
        console.log('❌ Missing credentials for donor update');
        return false;
      }

      // Check last update time
      const lastUpdate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_DONOR_UPDATE);
      const now = new Date();
      
      // If never updated before, set to 30 days ago to trigger first update
      const lastUpdateDate = lastUpdate ? new Date(lastUpdate) : new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
      
      // Calculate days difference
      const timeDiff = now.getTime() - lastUpdateDate.getTime();
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      
      console.log(`📅 Days since last update: ${daysDiff}`);

      // Calculate next update date for display
      const nextUpdate = new Date(lastUpdateDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      setNextUpdateDate(nextUpdate.toDateString());

      // Only update if 30 days or more have passed
      if (daysDiff >= 30) {
        console.log('🔄 30 days passed, updating donor status...');
        
        const response = await fetch('https://blood-donate-app-9c09.onrender.com/user/isdonor', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: userId,
            isDonor: true
          })
        });

        const data = await response.json();
        
        if (data.success) {
          console.log('✅ Donor status updated successfully');
          
          // Save update timestamp
          await AsyncStorage.setItem(STORAGE_KEYS.LAST_DONOR_UPDATE, now.toISOString());
          
          // Refresh user data after update
          await loadUserData(true);
          
          Alert.alert("Success", "Your donor status has been automatically updated!");
        } else {
          console.log('❌ API response error:', data.message);
        }
        
        return true;
      } else {
        const daysRemaining = 30 - daysDiff;
        console.log(`⏰ Next update in ${daysRemaining} days`);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error updating donor status:', error);
      return false;
    }
  };

  // Force update donor status manually
  const handleForceUpdateDonor = async () => {
    setMenuOpen(false);
    
    Alert.alert(
      "Update Donor Status",
      "Do you want to update your donor status to 'Donor' now?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update Now",
          onPress: async () => {
            try {
              setIsUpdatingDonor(true);
              
              const [userId, token] = await Promise.all([
                AsyncStorage.getItem(STORAGE_KEYS.USER_ID),
                AsyncStorage.getItem(STORAGE_KEYS.TOKEN)
              ]);

              if (!userId || !token) {
                Alert.alert("Error", "Please login again");
                return;
              }

              console.log('🔄 Force updating donor status...');
              
              const response = await fetch('https://blood-donate-app-9c09.onrender.com/user/isdonor', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  userId: userId,
                  isDonor: true
                })
              });

              const data = await response.json();
              
              if (data.success) {
                console.log('✅ Force update successful');
                
                // Save update timestamp
                await AsyncStorage.setItem(STORAGE_KEYS.LAST_DONOR_UPDATE, new Date().toISOString());
                
                // Refresh user data
                await loadUserData(true);
                
                Alert.alert("Success", "Your donor status has been updated!");
                
                // Update next update date
                const nextUpdate = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000);
                setNextUpdateDate(nextUpdate.toDateString());
              } else {
                Alert.alert("Error", data.message || "Failed to update donor status");
              }
              
            } catch (error) {
              console.error('Force update error:', error);
              Alert.alert("Error", "Failed to update donor status");
            } finally {
              setIsUpdatingDonor(false);
            }
          }
        }
      ]
    );
  };

  // Refresh user data manually
  const handleRefreshData = async () => {
    setMenuOpen(false);
    await loadUserData(true);
  };

  // FCM Token Resend Function
  const handleResendFCMToken = async () => {
    setMenuOpen(false);
    
    if (!userData) {
      Alert.alert("Error", "User not logged in");
      return;
    }
    
    const userId = userData._id || userData.id;
    
    Alert.alert(
      "Resend FCM Token",
      "Force resend push notification token?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resend",
          onPress: async () => {
            setFcmStatus(prev => ({ ...prev, loading: true }));
            
            // Reset and resend
            await fcmServiceInstance.resetFCMData();
            const result = await fcmServiceInstance.initializeForUser(userId);
            
            if (result.success) {
              Alert.alert("Success", "FCM token resent successfully!");
              setFcmStatus({ 
                sent: true, 
                loading: false, 
                message: 'Token resent successfully' 
              });
            } else {
              Alert.alert("Error", result.error || "Failed to resend token");
              setFcmStatus({ 
                sent: false, 
                loading: false, 
                message: result.error || 'Failed' 
              });
            }
          }
        }
      ]
    );
  };

  // Load user data on component mount
  useEffect(() => {
    loadUserData();
  }, []);

  // Get user data helper functions
  const getUsername = () => {
    return userData?.username || "User";
  };

  const getBloodGroup = () => {
    return userData?.bloodGroup || "Unknown";
  };

  const getProfilePicUrl = () => {
    return userData?.profilePic?.url || null;
  };

  const getAge = () => {
    return userData?.age || "";
  };

  const getGender = () => {
    if (userData?.gender) {
      return userData.gender.charAt(0).toUpperCase() + userData.gender.slice(1);
    }
    return "";
  };

  const getEmail = () => {
    return userData?.email || "";
  };

  const getPhone = () => {
    return userData?.phone || "";
  };

  const getDonorStatusText = () => {
    if (userData?.isDonor) {
      return "✅ Registered Donor";
    }
    return "❌ Not a Donor";
  };

  // Logout function
  const handleLogout = async () => {
    setMenuOpen(false);
    
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoggingOut(true);
              
              const userId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
              
              if (userId) {
                await fetch(`https://blood-donate-app-9c09.onrender.com/user/logout/${userId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                });
              }
              
              // Clear AsyncStorage
              await AsyncStorage.clear();
              
              // Navigate to Login
              navigation.replace('Login');
              
            } catch (error) {
              console.error('Logout error:', error);
              await AsyncStorage.clear();
              navigation.replace('Login');
            } finally {
              setIsLoggingOut(false);
            }
          }
        }
      ]
    );
  };

  // Responsive values
  const responsiveFont = {
    small: isSmallScreen ? 10 : 12,
    medium: isSmallScreen ? 12 : 14,
    large: isSmallScreen ? 14 : 16,
    xlarge: isSmallScreen ? 16 : 18,
    xxlarge: isSmallScreen ? 20 : 24,
  };

  const responsivePadding = {
    horizontal: isSmallScreen ? 16 : 20,
    vertical: isSmallScreen ? 8 : 12,
  };

  const iconSize = {
    small: isSmallScreen ? 16 : 20,
    medium: isSmallScreen ? 20 : 24,
    large: isSmallScreen ? 24 : 28,
  };

  // Show loading screen
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d32f2f" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
        {fcmStatus.loading && (
          <Text style={styles.fcmLoadingText}>Setting up notifications...</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#d32f2f" barStyle="light-content" />
      
      {/* HEADER */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={[styles.header, { paddingHorizontal: responsivePadding.horizontal }]}>
          <View>
            <Text style={[styles.appName, { fontSize: responsiveFont.xxlarge }]}>RapidDonor</Text>
            <Text style={[styles.userGreeting, { fontSize: responsiveFont.medium }]}>
              Hi, {getUsername()} 👋
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={() => setMenuOpen(!menuOpen)}
          >
            <MaterialIcons name="more-vert" size={iconSize.large} color="#fff" />
          </TouchableOpacity>
          
          {/* THREE DOT MENU */}
          {menuOpen && (
            <View style={[styles.menuBox, { top: height * 0.08 }]}>
              {/* Refresh Data */}
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={handleRefreshData}
              >
                <Ionicons name="refresh-outline" size={iconSize.small} color="#1976d2" />
                <Text style={[styles.menuText, { fontSize: responsiveFont.medium }]}>
                  Refresh Data
                </Text>
              </TouchableOpacity>
              
              {/* Update Donor Status */}
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={handleForceUpdateDonor}
                disabled={isUpdatingDonor}
              >
                {isUpdatingDonor ? (
                  <ActivityIndicator size="small" color="#4CAF50" />
                ) : (
                  <FontAwesome5 name="hand-holding-heart" size={iconSize.small} color="#4CAF50" />
                )}
                <Text style={[styles.menuText, { fontSize: responsiveFont.medium }]}>
                  {isUpdatingDonor ? 'Updating...' : 'Update Donor Status'}
                </Text>
              </TouchableOpacity>
              
              {/* FCM Token Resend */}
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={handleResendFCMToken}
                disabled={fcmStatus.loading}
              >
                {fcmStatus.loading ? (
                  <ActivityIndicator size="small" color="#FF9800" />
                ) : (
                  <Ionicons name="notifications-outline" size={iconSize.small} color="#FF9800" />
                )}
                <Text style={[styles.menuText, { fontSize: responsiveFont.medium }]}>
                  {fcmStatus.loading ? 'Processing...' : 'Resend FCM Token'}
                </Text>
              </TouchableOpacity>
              
              {/* FCM Status Indicator */}
              <View style={styles.fcmStatusItem}>
                <Ionicons 
                  name={fcmStatus.sent ? "checkmark-circle" : "close-circle"} 
                  size={iconSize.small} 
                  color={fcmStatus.sent ? "#4CAF50" : "#f44336"} 
                />
                <Text style={[styles.fcmStatusText, { fontSize: responsiveFont.small }]}>
                  Notifications: {fcmStatus.sent ? 'Active' : 'Inactive'}
                </Text>
              </View>
              
              {/* Logout Button */}
              <TouchableOpacity 
                style={[styles.menuItem, styles.logoutItem]}
                onPress={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color="#ff4757" />
                ) : (
                  <Ionicons name="log-out-outline" size={iconSize.small} color="#ff4757" />
                )}
                <Text style={[styles.menuText, styles.logoutText, { fontSize: responsiveFont.medium }]}>
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: height * 0.12 }
        ]}
      >
        {/* PROFILE PREVIEW */}
        <View style={[styles.profileCard, { marginHorizontal: responsivePadding.horizontal }]}>
          <View style={styles.profileHeader}>
            {getProfilePicUrl() ? (
              <Image 
                source={{ uri: getProfilePicUrl() }}
                style={[
                  styles.profileImage,
                  { 
                    width: isSmallScreen ? 70 : 80,
                    height: isSmallScreen ? 70 : 80,
                    borderRadius: 35,
                  }
                ]}
                resizeMode="cover"
              />
            ) : (
              <View style={[
                styles.profilePlaceholder,
                { 
                  width: isSmallScreen ? 70 : 80,
                  height: isSmallScreen ? 70 : 80,
                  borderRadius: 35,
                }
              ]}>
                <Ionicons name="person" size={iconSize.large} color="#d32f2f" />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { fontSize: responsiveFont.large }]}>
                {getUsername()}
              </Text>
              <View style={styles.userDetailsRow}>
                <View style={styles.detailBadge}>
                  <Text style={[styles.detailBadgeText, { fontSize: responsiveFont.small - 1 }]}>
                    {getAge()} yrs
                  </Text>
                </View>
                <View style={styles.detailBadge}>
                  <Text style={[styles.detailBadgeText, { fontSize: responsiveFont.small - 1 }]}>
                    {getGender()}
                  </Text>
                </View>
                <View style={[styles.detailBadge, styles.bloodBadge]}>
                  <Text style={[styles.detailBadgeText, styles.bloodBadgeText, { fontSize: responsiveFont.small - 1 }]}>
                    {getBloodGroup()}
                  </Text>
                </View>
              </View>
              <Text style={[styles.profileEmail, { fontSize: responsiveFont.small }]}>
                {getEmail()}
              </Text>
              <View style={styles.locationContainer}>
                <Ionicons name="call-outline" size={iconSize.small} color="#666" />
                <Text style={[styles.locationText, { fontSize: responsiveFont.small }]}>
                  {getPhone()}
                </Text>
              </View>
              
              {/* DONOR STATUS SECTION */}
              <View style={styles.donorStatusSection}>
                <View style={styles.donorStatusRow}>
                  <Text style={[styles.donorStatusLabel, { fontSize: responsiveFont.small }]}>
                    Donor Status:
                  </Text>
                  <Text style={[
                    styles.donorStatusValue, 
                    { fontSize: responsiveFont.small },
                    userData?.isDonor ? styles.donorActive : styles.donorInactive
                  ]}>
                    {getDonorStatusText()}
                  </Text>
                </View>
                
                {/* FCM STATUS */}
                <View style={styles.fcmStatusRow}>
                  <Text style={[styles.fcmStatusLabel, { fontSize: responsiveFont.small - 1 }]}>
                    Notifications:
                  </Text>
                  <View style={styles.fcmStatusIndicator}>
                    <View style={[
                      styles.fcmStatusDot, 
                      { backgroundColor: fcmStatus.sent ? '#4CAF50' : '#f44336' }
                    ]} />
                    <Text style={[
                      styles.fcmStatusValue, 
                      { fontSize: responsiveFont.small - 1 },
                      fcmStatus.sent ? styles.fcmActive : styles.fcmInactive
                    ]}>
                      {fcmStatus.sent ? 'Active' : 'Setup Required'}
                    </Text>
                  </View>
                </View>
                
                {fcmStatus.message && (
                  <Text style={[styles.fcmMessage, { fontSize: responsiveFont.small - 2 }]}>
                    {fcmStatus.message}
                  </Text>
                )}
                
                <Text style={[styles.dataSourceText, { fontSize: responsiveFont.small - 1 }]}>
                  📡 Live data from server
                </Text>
                
                {nextUpdateDate && (
                  <View style={styles.nextUpdateRow}>
                    <Ionicons name="calendar-outline" size={iconSize.small} color="#666" />
                    <Text style={[styles.nextUpdateText, { fontSize: responsiveFont.small - 1 }]}>
                      Next auto-update: {nextUpdateDate}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          
          {/* PROFILE STATS */}
          <View style={styles.profileStats}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { fontSize: responsiveFont.xlarge }]}>0</Text>
              <Text style={[styles.statLabel, { fontSize: responsiveFont.small }]}>Donations</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { fontSize: responsiveFont.xlarge }]}>0</Text>
              <Text style={[styles.statLabel, { fontSize: responsiveFont.small }]}>Requests</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { fontSize: responsiveFont.xlarge }]}>0</Text>
              <Text style={[styles.statLabel, { fontSize: responsiveFont.small }]}>Lives Saved</Text>
            </View>
          </View>
        </View>

        {/* EMERGENCY BUTTON */}
        <TouchableOpacity 
          style={[styles.emergencyBtn, { marginHorizontal: responsivePadding.horizontal }]}
          onPress={() => {
            // Navigate to emergency request screen
            navigation.navigate('Request');
          }}
        >
          <View style={styles.emergencyIconContainer}>
            <Ionicons name="warning" size={iconSize.medium} color="#fff" />
          </View>
          <View style={styles.emergencyTextContainer}>
            <Text style={[styles.emergencyTitle, { fontSize: responsiveFont.medium }]}>EMERGENCY BLOOD NEEDED</Text>
            <Text style={[styles.emergencySubtitle, { fontSize: responsiveFont.small }]}>Tap to request blood urgently</Text>
          </View>
          <Ionicons name="arrow-forward" size={iconSize.medium} color="#fff" />
        </TouchableOpacity>

        {/* QUICK ACTIONS */}
        <Text style={[styles.sectionTitle, { 
          fontSize: responsiveFont.large,
          marginHorizontal: responsivePadding.horizontal,
          marginTop: responsivePadding.vertical * 2
        }]}>
          Quick Actions
        </Text>
        <View style={[styles.quickActions, { marginHorizontal: responsivePadding.horizontal }]}>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIcon, { 
              width: isSmallScreen ? 50 : 60,
              height: isSmallScreen ? 50 : 60,
              backgroundColor: '#e3f2fd' 
            }]}>
              <Ionicons name="search" size={iconSize.medium} color="#1976d2" />
            </View>
            <Text style={[styles.actionText, { fontSize: responsiveFont.small }]}>Find Donors</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIcon, { 
              width: isSmallScreen ? 50 : 60,
              height: isSmallScreen ? 50 : 60,
              backgroundColor: '#f3e5f5' 
            }]}>
              <MaterialIcons name="bloodtype" size={iconSize.medium} color="#7b1fa2" />
            </View>
            <Text style={[styles.actionText, { fontSize: responsiveFont.small }]}>Blood Info</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIcon, { 
              width: isSmallScreen ? 50 : 60,
              height: isSmallScreen ? 50 : 60,
              backgroundColor: '#e8f5e8' 
            }]}>
              <FontAwesome5 name="hand-holding-heart" size={isSmallScreen ? 18 : 22} color="#2e7d32" />
            </View>
            <Text style={[styles.actionText, { fontSize: responsiveFont.small }]}>Eligibility</Text>
          </TouchableOpacity>
        </View>

        {/* NEARBY REQUESTS */}
        <View style={[styles.sectionHeader, { marginHorizontal: responsivePadding.horizontal }]}>
          <Text style={[styles.sectionTitle, { 
            fontSize: responsiveFont.large,
            marginTop: responsivePadding.vertical * 2,
            marginBottom: responsivePadding.vertical
          }]}>
            Blood Requests Nearby
          </Text>
          <TouchableOpacity>
            <Text style={[styles.seeAllText, { fontSize: responsiveFont.small }]}>See All</Text>
          </TouchableOpacity>
        </View>

        {MOCK_REQUESTS.map((item) => (
          <View key={item.id} style={[styles.requestCard, { marginHorizontal: responsivePadding.horizontal }]}>
            <View style={styles.requestHeader}>
              <View style={styles.bloodGroupBadge}>
                <Text style={[styles.bloodGroupText, { fontSize: responsiveFont.small }]}>{item.blood}</Text>
              </View>
              <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(item.urgency) }]}>
                <Text style={[styles.urgencyText, { fontSize: responsiveFont.small - 2 }]}>
                  {getUrgencyText(item.urgency)}
                </Text>
              </View>
            </View>
            
            <Text style={[styles.requestName, { fontSize: responsiveFont.medium }]}>{item.name}</Text>
            
            <View style={styles.requestDetails}>
              <View style={styles.detailItem}>
                <Ionicons name="location-outline" size={iconSize.small} color="#666" />
                <Text style={[styles.detailText, { fontSize: responsiveFont.small }]}>{item.distance} away</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="medical-outline" size={iconSize.small} color="#666" />
                <Text style={[styles.detailText, { fontSize: responsiveFont.small }]}>{item.hospital}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="time-outline" size={iconSize.small} color="#666" />
                <Text style={[styles.detailText, { fontSize: responsiveFont.small }]}>{item.time}</Text>
              </View>
            </View>
            
            <View style={styles.requestActions}>
              <TouchableOpacity style={styles.chatButton}>
                <Ionicons name="chatbubble-outline" size={iconSize.small} color="#1976d2" />
                <Text style={[styles.chatButtonText, { fontSize: responsiveFont.small }]}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.donateBtn}>
                <Text style={[styles.donateText, { fontSize: responsiveFont.small }]}>Donate Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  headerSafeArea: {
    backgroundColor: "#d32f2f",
  },
  header: {
    backgroundColor: "#d32f2f",
    paddingTop: Platform.OS === 'android' ? 10 : 0,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  appName: {
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  userGreeting: {
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
  menuButton: {
    padding: 8,
  },
  menuBox: {
    position: "absolute",
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 8,
    width: 200,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  menuText: {
    color: "#333",
    marginLeft: 10,
    fontWeight: "500",
  },
  logoutItem: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    marginTop: 4,
  },
  logoutText: {
    color: "#ff4757",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 20,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorText: {
    marginTop: 20,
    color: '#ff4757',
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#d32f2f',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  profileCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    marginTop: 10,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileImage: {
    borderWidth: 2,
    borderColor: '#d32f2f',
  },
  profilePlaceholder: {
    backgroundColor: '#ffebee',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d32f2f',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontWeight: "700",
    color: "#333",
  },
  userDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 6,
  },
  detailBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 4,
  },
  detailBadgeText: {
    color: '#666',
    fontWeight: '500',
  },
  bloodBadge: {
    backgroundColor: '#ffebee',
  },
  bloodBadgeText: {
    color: '#d32f2f',
    fontWeight: '700',
  },
  profileEmail: {
    color: '#666',
    marginBottom: 2,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  locationText: {
    color: "#666",
    marginLeft: 4,
  },
  donorStatusSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  donorStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  donorStatusLabel: {
    color: '#666',
    fontWeight: '500',
  },
  donorStatusValue: {
    fontWeight: '600',
  },
  donorActive: {
    color: '#2e7d32',
  },
  donorInactive: {
    color: '#d32f2f',
  },
  dataSourceText: {
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 4,
  },
  nextUpdateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  nextUpdateText: {
    color: '#666',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  updateNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e3f2fd',
    marginTop: 4,
  },
  updateNowText: {
    color: '#1976d2',
    fontWeight: '600',
    marginLeft: 4,
  },
  profileStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontWeight: "700",
    color: "#d32f2f",
  },
  statLabel: {
    color: "#666",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#eee',
  },
  emergencyBtn: {
    backgroundColor: "#ff4757",
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    marginTop: 16,
  },
  emergencyIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 10,
  },
  emergencyTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  emergencyTitle: {
    color: "#fff",
    fontWeight: "700",
  },
  emergencySubtitle: {
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
  sectionTitle: {
    fontWeight: "700",
    color: "#333",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  seeAllText: {
    color: "#d32f2f",
    fontWeight: "600",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionItem: {
    alignItems: "center",
    flex: 1,
    marginHorizontal: 4,
  },
  actionIcon: {
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  actionText: {
    color: "#333",
    fontWeight: "500",
    textAlign: "center",
  },
  requestCard: {
    backgroundColor: "#fff",
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  bloodGroupBadge: {
    backgroundColor: "#ffebee",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  bloodGroupText: {
    color: "#d32f2f",
    fontWeight: "700",
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  urgencyText: {
    color: "#fff",
    fontWeight: "600",
  },
  requestName: {
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  requestDetails: {
    marginBottom: 14,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  detailText: {
    color: "#666",
    marginLeft: 6,
  },
  requestActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chatButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f0f7ff",
    borderWidth: 1,
    borderColor: "#e3f2fd",
  },
  chatButtonText: {
    color: "#1976d2",
    fontWeight: "600",
    marginLeft: 4,
  },
  donateBtn: {
    backgroundColor: "#d32f2f",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    flex: 1,
    marginLeft: 10,
    alignItems: "center",
  },
  donateText: {
    color: "#fff",
    fontWeight: "700",
  },
  bottomNavSafeArea: {
    backgroundColor: "#fff",
  },
  bottomNav: {
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    paddingVertical: 10,
    minHeight: 60,
  },
  navItem: {
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
  },
  activeNavItem: {
    backgroundColor: "#ffebee",
  },
  navText: {
    color: "#666",
    marginTop: 2,
    fontWeight: "500",
    textAlign: "center",
  },
  activeNavText: {
    color: "#d32f2f",
    fontWeight: "700",
  },
});