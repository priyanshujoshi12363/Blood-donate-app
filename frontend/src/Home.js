import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image, // Make sure this is imported
  useWindowDimensions,
} from "react-native";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage keys
const STORAGE_KEYS = {
  TOKEN: '@auth_token',
  SESSION_ID: '@session_id',
  USER_ID: '@user_id',
  USER_DATA: '@user_data',
  IS_LOGGED_IN: '@is_logged_in'
};

export default function HomeScreen({ navigation }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("blood");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 375;

  // Load user data on component mount
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setIsLoading(true);
      const userDataStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      console.log('Raw user data from storage:', userDataStr);
      
      if (userDataStr) {
        const parsedData = JSON.parse(userDataStr);
        console.log('Parsed user data:', parsedData);
        setUserData(parsedData);
      } else {
        console.warn('No user data found in AsyncStorage');
        // If no user data, redirect to login
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

  // Get username from stored data
  const getUsername = () => {
    if (userData && userData.username) {
      return userData.username;
    }
    return "User";
  };

  // Get blood group from stored data
  const getBloodGroup = () => {
    if (userData && userData.bloodGroup) {
      return userData.bloodGroup;
    }
    return "Unknown";
  };

  // Get profile picture URL
  const getProfilePicUrl = () => {
    if (userData && userData.profilePic && userData.profilePic.url) {
      return userData.profilePic.url;
    }
    return null;
  };

  // Get age from stored data
  const getAge = () => {
    if (userData && userData.age) {
      return userData.age;
    }
    return "";
  };

  // Get gender from stored data
  const getGender = () => {
    if (userData && userData.gender) {
      return userData.gender.charAt(0).toUpperCase() + userData.gender.slice(1);
    }
    return "";
  };

  // Get email from stored data
  const getEmail = () => {
    if (userData && userData.email) {
      return userData.email;
    }
    return "";
  };

  // Get phone from stored data
  const getPhone = () => {
    if (userData && userData.phone) {
      return userData.phone;
    }
    return "";
  };

  // Get donor status
  const getDonorStatus = () => {
    if (userData && userData.isDonor !== undefined) {
      return userData.isDonor ? "Registered Donor" : "Not Registered as Donor";
    }
    return "Unknown";
  };

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
              
              // Get user ID from AsyncStorage
              const userId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
              
              if (userId) {
                // Call logout API
                const response = await fetch(`https://blood-donate-app-9c09.onrender.com/user/logout/${userId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                });
                
                const data = await response.json();
                console.log('Logout API response:', data);
              }
              
              // Clear AsyncStorage
              await clearStorage();
              
              // Navigate to Login
              navigation.replace('Login');
              
            } catch (error) {
              console.error('Logout error:', error);
              await clearStorage();
              navigation.replace('Login');
            } finally {
              setIsLoggingOut(false);
            }
          }
        }
      ]
    );
  };

  const clearStorage = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.SESSION_ID,
        STORAGE_KEYS.USER_ID,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.IS_LOGGED_IN,
        '@user_info'
      ]);
      console.log('AsyncStorage cleared');
    } catch (error) {
      console.error('Error clearing AsyncStorage:', error);
    }
  };

  // Responsive font sizes
  const responsiveFont = {
    small: isSmallScreen ? 10 : 12,
    medium: isSmallScreen ? 12 : 14,
    large: isSmallScreen ? 14 : 16,
    xlarge: isSmallScreen ? 16 : 18,
    xxlarge: isSmallScreen ? 20 : 24,
  };

  // Responsive padding
  const responsivePadding = {
    horizontal: isSmallScreen ? 16 : 20,
    vertical: isSmallScreen ? 8 : 12,
  };

  // Responsive icon sizes
  const iconSize = {
    small: isSmallScreen ? 16 : 20,
    medium: isSmallScreen ? 20 : 24,
    large: isSmallScreen ? 24 : 28,
  };

  // Show loading screen while fetching data
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d32f2f" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  // If no user data, show error
  if (!userData) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={60} color="#ff4757" />
        <Text style={styles.errorText}>Failed to load user data</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={loadUserData}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#d32f2f" barStyle="light-content" />
      
      {/* HEADER WITH APP NAME */}
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
          
               {menuOpen && (
            <View style={[styles.menuBox, { top: height * 0.08 }]}>
              <TouchableOpacity 
                style={[styles.menuItem, styles.logoutItem]}
                onPress={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color="#ff4757" />
                ) : (
                  <Ionicons name="log-out-outline" size={iconSize.small} color="#ff4757" />
                )}
                <Text style={[
                  styles.menuText, 
                  styles.logoutText, 
                  { fontSize: isSmallScreen ? 12 : 14 },
                  isLoggingOut && { opacity: 0.7 }
                ]}>
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
                    width: isSmallScreen ? 60 : 70,
                    height: isSmallScreen ? 60 : 70,
                    borderRadius: 35,
                  }
                ]}
              />
            ) : (
              <View style={[
                styles.profilePlaceholder,
                { 
                  width: isSmallScreen ? 60 : 70,
                  height: isSmallScreen ? 60 : 70,
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
              <View style={styles.donorStatusContainer}>
                <Ionicons 
                  name={userData.isDonor ? "checkmark-circle" : "close-circle"} 
                  size={iconSize.small} 
                  color={userData.isDonor ? "#2e7d32" : "#757575"} 
                />
                <Text style={[
                  styles.donorStatusText, 
                  { fontSize: responsiveFont.small },
                  { color: userData.isDonor ? "#2e7d32" : "#757575" }
                ]}>
                  {getDonorStatus()}
                </Text>
              </View>
            </View>
          </View>
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

        {/* Rest of your code remains the same... */}
        {/* EMERGENCY BUTTON */}
        <TouchableOpacity 
          style={[styles.emergencyBtn, { marginHorizontal: responsivePadding.horizontal }]}
          onPress={() => {
            // Navigate to emergency request screen
            // navigation.navigate('EmergencyRequest');
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

        {/* Rest of your existing code... */}
        {/* Keep all your existing MOCK_REQUESTS, quick actions, etc. */}
        
      </ScrollView>

      {/* BOTTOM NAV BAR */}
      <SafeAreaView style={styles.bottomNavSafeArea}>
        <View style={[styles.bottomNav, { paddingBottom: Platform.OS === 'ios' ? height * 0.02 : 0 }]}>
          {/* Keep your existing bottom nav */}
        </View>
      </SafeAreaView>
    </View>
  );
}

// Add these new styles
const styles = StyleSheet.create({
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
  userDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 2,
  },
  detailBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
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
    marginBottom: 4,
  },
  donorStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  donorStatusText: {
    marginLeft: 4,
    fontWeight: '500',
  },
  
  // Keep all your existing styles below...
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
    paddingBottom: 20,
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
    width: 160,
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
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontWeight: "700",
    color: "#333",
  },
  profileBlood: {
    color: "#666",
    marginTop: 2,
  },
  bloodGroup: {
    color: "#d32f2f",
    fontWeight: "700",
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