import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
  Alert,
  RefreshControl,
  Linking,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_BASE_URL = 'https://blood-donate-app-9c09.onrender.com';

// AsyncStorage keys
const STORAGE_KEYS = {
  TOKEN: '@auth_token',
  SESSION_ID: '@session_id',
  USER_ID: '@user_id',
  USER_DATA: '@user_data',
  IS_LOGGED_IN: '@is_logged_in'
};

// Blood Donation Theme Colors
const BLOOD_THEME = {
  primaryRed: '#D32F2F',       // Main blood red
  primaryLight: '#FF5252',     // Lighter red
  primaryDark: '#9A0007',      // Darker red
  secondary: '#FFEBEE',        // Light red background
  success: '#4CAF50',          // Green for available
  error: '#F44336',            // Red for not available
  background: '#FFFFFF',       // White background
  surface: '#F5F5F5',          // Light gray surface
  textPrimary: '#212121',      // Dark text
  textSecondary: '#757575',    // Gray text
  textOnPrimary: '#FFFFFF',    // White text on red
  bloodA: '#FF6B6B',           // A type red
  bloodB: '#4ECDC4',           // B type teal
  bloodO: '#FFD166',           // O type yellow
  bloodAB: '#9C27B0',          // AB type purple
};

const Profile = ({ navigation }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState('');

  // Load user data and token
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const [storedData, storedToken, storedUserId, isLoggedIn] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER_ID),
        AsyncStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN)
      ]);

      if (!storedData || !storedToken || !storedUserId || isLoggedIn !== 'true') {
        Alert.alert('Session Expired', 'Please login again');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
        return;
      }

      const parsedData = JSON.parse(storedData);
      setToken(storedToken);
      fetchUserProfile(storedUserId, storedToken, parsedData);
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'Failed to load user data');
      setLoading(false);
    }
  };

  const fetchUserProfile = async (userId, userToken, cachedData) => {
    try {
      if (cachedData) {
        setUserData(cachedData);
      }

      const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        const freshData = result.data;
        setUserData(freshData);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(freshData));
      } else {
        console.warn('Failed to fetch fresh data:', result.message);
        if (!cachedData) {
          Alert.alert('Warning', 'Could not load latest data');
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (!cachedData) {
        Alert.alert('Network Error', 'Using cached profile data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUserData();
  };

  const handleEdit = (field, value) => {
    setEditingField(field);
    setEditValue(value || '');
  };

  const saveEdit = async () => {
    if (!userData || !token || !editingField) return;

    setSaving(true);
    
    try {
      const userId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
      if (!userId) {
        throw new Error('User ID not found');
      }

      const updatePayload = { [editingField]: editValue };
      const response = await fetch(`${API_BASE_URL}/user/edit/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const updatedUserData = { ...userData, [editingField]: editValue };
        setUserData(updatedUserData);
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUserData));
        Alert.alert('Success', `${editingField.charAt(0).toUpperCase() + editingField.slice(1)} updated successfully!`);
      } else {
        Alert.alert('Error', result.message || 'Failed to update');
      }
    } catch (error) {
      console.error('Error updating:', error);
      Alert.alert('Error', error.message || 'Network error. Please try again.');
    } finally {
      setSaving(false);
      setEditingField(null);
      setEditValue('');
    }
  };

  const formatPhone = (phone) => {
    if (!phone) return '';
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  };

  const getBloodTypeColor = (bloodGroup) => {
    if (!bloodGroup) return BLOOD_THEME.primaryRed;
    
    const type = bloodGroup.charAt(0);
    switch(type) {
      case 'A': return BLOOD_THEME.bloodA;
      case 'B': return BLOOD_THEME.bloodB;
      case 'O': return BLOOD_THEME.bloodO;
      case 'A': return BLOOD_THEME.bloodAB;
      default: return BLOOD_THEME.primaryRed;
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                STORAGE_KEYS.TOKEN,
                STORAGE_KEYS.SESSION_ID,
                STORAGE_KEYS.USER_ID,
                STORAGE_KEYS.USER_DATA,
                STORAGE_KEYS.IS_LOGGED_IN
              ]);
              
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  const makePhoneCall = (phoneNumber) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const getInitials = (username) => {
    if (!username) return 'U';
    return username
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // FIXED: Use valid Material Community icon names
  const getGenderIcon = (gender) => {
    switch(gender?.toLowerCase()) {
      case 'male': return 'gender-male';      // Valid icon name
      case 'female': return 'gender-female';  // Valid icon name
      default: return 'account-outline';      // Valid icon name
    }
  };

  const getAvailabilityStatus = (available) => {
    return available ? 'Available' : 'Not Available';
  };

  const getAvailabilityColor = (available) => {
    return available ? BLOOD_THEME.success : BLOOD_THEME.error;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar backgroundColor={BLOOD_THEME.primaryRed} barStyle="light-content" />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={BLOOD_THEME.primaryRed} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={BLOOD_THEME.primaryRed} barStyle="light-content" />
      
      {/* Header with Red Theme */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={BLOOD_THEME.textOnPrimary} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>My Profile</Text>
        
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="log-out-outline" size={24} color={BLOOD_THEME.textOnPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BLOOD_THEME.primaryRed}
            colors={[BLOOD_THEME.primaryRed]}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header Card with Red Theme */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {userData?.profilePic?.url ? (
              <Image 
                source={{ uri: userData.profilePic.url }} 
                style={styles.avatarImage}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: getBloodTypeColor(userData?.bloodGroup) }]}>
                <Text style={styles.avatarText}>
                  {getInitials(userData?.username)}
                </Text>
              </View>
            )}
            <View style={[styles.availabilityBadge, { backgroundColor: getAvailabilityColor(userData?.available) }]}>
              <Ionicons 
                name={userData?.available ? "checkmark-circle" : "close-circle"} 
                size={12} 
                color="#FFF" 
              />
              <Text style={styles.availabilityText}>
                {getAvailabilityStatus(userData?.available)}
              </Text>
            </View>
            <View style={styles.bloodTypeBadge}>
              <MaterialCommunityIcons name="water" size={14} color="#FFF" />
              <Text style={styles.bloodTypeText}>
                {userData?.bloodGroup || 'N/A'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.userName}>{userData?.username || 'User'}</Text>
          <Text style={styles.userEmail}>{userData?.email || 'No email'}</Text>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons 
                name={getGenderIcon(userData?.gender)} 
                size={20} 
                color={BLOOD_THEME.primaryRed} 
              />
              <Text style={styles.statNumber}>
                {userData?.gender ? userData.gender.charAt(0).toUpperCase() + userData.gender.slice(1) : 'N/A'}
              </Text>
              <Text style={styles.statLabel}>Gender</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Ionicons name="calendar-outline" size={20} color={BLOOD_THEME.primaryRed} />
              <Text style={styles.statNumber}>{userData?.age || 'N/A'}</Text>
              <Text style={styles.statLabel}>Age</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <FontAwesome5 name={userData?.isDonor ? "hand-holding-heart" : "user"} size={18} color={BLOOD_THEME.primaryRed} />
              <Text style={styles.statNumber}>
                {userData?.isDonor ? 'Yes' : 'No'}
              </Text>
              <Text style={styles.statLabel}>Donor</Text>
            </View>
          </View>
        </View>

        {/* Personal Information Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle-outline" size={24} color={BLOOD_THEME.primaryRed} />
            <Text style={styles.cardTitle}>Personal Information</Text>
          </View>
          
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="person-outline" size={18} color={BLOOD_THEME.textSecondary} />
                <Text style={styles.infoLabel}>Username</Text>
              </View>
              <View style={styles.infoValueContainer}>
                <Text style={styles.infoValue}>{userData?.username || 'Not set'}</Text>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => handleEdit('username', userData?.username)}
                >
                  <Ionicons name="pencil" size={16} color={BLOOD_THEME.primaryRed} />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="mail-outline" size={18} color={BLOOD_THEME.textSecondary} />
                <Text style={styles.infoLabel}>Email</Text>
              </View>
              <View style={styles.infoValueContainer}>
                <Text style={styles.infoValue}>{userData?.email || 'Not set'}</Text>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => handleEdit('email', userData?.email)}
                >
                  <Ionicons name="pencil" size={16} color={BLOOD_THEME.primaryRed} />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="call-outline" size={18} color={BLOOD_THEME.textSecondary} />
                <Text style={styles.infoLabel}>Phone</Text>
              </View>
              <View style={styles.infoValueContainer}>
                <TouchableOpacity onPress={() => makePhoneCall(userData?.phone)}>
                  <Text style={[styles.infoValue, userData?.phone && styles.phoneLink]}>
                    {formatPhone(userData?.phone) || 'Not set'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => handleEdit('phone', userData?.phone)}
                >
                  <Ionicons name="pencil" size={16} color={BLOOD_THEME.primaryRed} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Medical Information Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="medical-bag" size={24} color={BLOOD_THEME.primaryRed} />
            <Text style={styles.cardTitle}>Medical Information</Text>
          </View>
          
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <MaterialCommunityIcons name="water" size={18} color={BLOOD_THEME.textSecondary} />
                <Text style={styles.infoLabel}>Blood Group</Text>
              </View>
              <View style={[styles.bloodTypeDisplay, { backgroundColor: getBloodTypeColor(userData?.bloodGroup) + '20' }]}>
                <Text style={[styles.bloodTypeValue, { color: getBloodTypeColor(userData?.bloodGroup) }]}>
                  {userData?.bloodGroup || 'Unknown'}
                </Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <MaterialCommunityIcons name={getGenderIcon(userData?.gender)} size={18} color={BLOOD_THEME.textSecondary} />
                <Text style={styles.infoLabel}>Gender</Text>
              </View>
              <Text style={styles.infoValue}>
                {userData?.gender ? userData.gender.charAt(0).toUpperCase() + userData.gender.slice(1) : 'Not set'}
              </Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="calendar-outline" size={18} color={BLOOD_THEME.textSecondary} />
                <Text style={styles.infoLabel}>Age</Text>
              </View>
              <Text style={styles.infoValue}>
                {userData?.age || 'Not set'}
              </Text>
            </View>
          </View>
        </View>

        {/* Donor Status Card with Red Theme */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FontAwesome5 name="hand-holding-heart" size={22} color={BLOOD_THEME.primaryRed} />
            <Text style={styles.cardTitle}>Donor Status</Text>
          </View>
          
          <View style={styles.infoSection}>
            <View style={styles.donorStatusRow}>
              <View style={styles.statusIndicator}>
                <Ionicons 
                  name={userData?.isDonor ? "checkmark-circle" : "close-circle"} 
                  size={24} 
                  color={userData?.isDonor ? BLOOD_THEME.success : BLOOD_THEME.error} 
                />
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>
                    {userData?.isDonor ? 'Registered Donor' : 'Not a Donor'}
                  </Text>
                  <Text style={styles.statusSubtitle}>
                    {userData?.isDonor 
                      ? 'Thank you for being a blood donor!' 
                      : 'Consider registering as a blood donor to save lives'}
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.donorStatusRow}>
              <View style={styles.statusIndicator}>
                <Ionicons 
                  name={userData?.available ? "checkmark-circle" : "close-circle"} 
                  size={24} 
                  color={userData?.available ? BLOOD_THEME.success : BLOOD_THEME.error} 
                />
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>
                    Availability: {getAvailabilityStatus(userData?.available)}
                  </Text>
                  <Text style={styles.statusSubtitle}>
                    {userData?.available 
                      ? 'You are currently available for donations' 
                      : 'You are currently not available for donations'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions with Red Theme */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="flash-outline" size={24} color={BLOOD_THEME.primaryRed} />
            <Text style={styles.cardTitle}>Quick Actions</Text>
          </View>
          
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('CreateRequest')}
            >
              <View style={[styles.actionIcon, { backgroundColor: BLOOD_THEME.primaryRed }]}>
                <MaterialCommunityIcons name="hospital-box" size={20} color="#FFF" />
              </View>
              <Text style={styles.actionText}>Create Request</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('YourRequest')}
            >
              <View style={[styles.actionIcon, { backgroundColor: BLOOD_THEME.primaryLight }]}>
                <MaterialCommunityIcons name="clipboard-list" size={20} color="#FFF" />
              </View>
              <Text style={styles.actionText}>My Requests</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => Alert.alert('Coming Soon', 'Donor settings coming soon!')}
            >
              <View style={[styles.actionIcon, { backgroundColor: BLOOD_THEME.primaryDark }]}>
                <FontAwesome5 name="hand-holding-heart" size={18} color="#FFF" />
              </View>
              <Text style={styles.actionText}>Donor Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Create Blood Request Button */}
        <TouchableOpacity 
          style={styles.createRequestButton}
          onPress={() => navigation.navigate('CreateRequest')}
          activeOpacity={0.9}
        >
          <Ionicons name="water" size={22} color="#FFF" />
          <Text style={styles.createRequestText}>Create Blood Request</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={!!editingField}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingField(null)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Edit {editingField?.charAt(0).toUpperCase() + editingField?.slice(1)}
              </Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setEditingField(null)}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <TextInput
                style={[styles.editInput]}
                value={editValue}
                onChangeText={setEditValue}
                placeholder={`Enter your ${editingField}`}
                autoFocus={true}
                keyboardType={
                  editingField === 'phone' ? 'phone-pad' : 
                  editingField === 'email' ? 'email-address' : 
                  editingField === 'age' ? 'numeric' : 'default'
                }
                maxLength={editingField === 'phone' ? 10 : undefined}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setEditingField(null)}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.saveButton, (!editValue.trim() || saving) && styles.disabledButton]}
                  onPress={saveEdit}
                  disabled={saving || !editValue.trim()}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                      <Text style={styles.saveButtonText}>Save</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLOOD_THEME.background,
  },
  
  // Header with Red Theme
  header: {
    backgroundColor: BLOOD_THEME.primaryRed,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: BLOOD_THEME.textOnPrimary,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'System',
  },
  logoutButton: {
    padding: 4,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    backgroundColor: BLOOD_THEME.background,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: BLOOD_THEME.textSecondary,
    fontFamily: 'System',
  },

  // Scroll View
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },

  // Profile Header Card with Red Theme
  profileHeader: {
    backgroundColor: BLOOD_THEME.secondary,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: BLOOD_THEME.background,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: BLOOD_THEME.background,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: BLOOD_THEME.textOnPrimary,
    fontFamily: 'System',
  },
  availabilityBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 3,
  },
  availabilityText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
    fontFamily: 'System',
  },
  bloodTypeBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: BLOOD_THEME.primaryRed,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    elevation: 3,
  },
  bloodTypeText: {
    color: BLOOD_THEME.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
    fontFamily: 'System',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: BLOOD_THEME.textPrimary,
    marginBottom: 4,
    fontFamily: 'System',
  },
  userEmail: {
    fontSize: 14,
    color: BLOOD_THEME.textSecondary,
    marginBottom: 20,
    fontFamily: 'System',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: BLOOD_THEME.surface,
    borderRadius: 16,
    padding: 16,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: BLOOD_THEME.primaryRed,
    marginVertical: 6,
    fontFamily: 'System',
  },
  statLabel: {
    fontSize: 12,
    color: BLOOD_THEME.textSecondary,
    fontFamily: 'System',
  },
  statDivider: {
    width: 1,
    backgroundColor: BLOOD_THEME.secondary,
    marginHorizontal: 4,
  },

  // Card Component
  card: {
    backgroundColor: BLOOD_THEME.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: BLOOD_THEME.secondary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: BLOOD_THEME.textPrimary,
    marginLeft: 12,
    fontFamily: 'System',
  },

  // Info Section
  infoSection: {
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  donorStatusRow: {
    paddingVertical: 12,
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: BLOOD_THEME.textSecondary,
    marginLeft: 12,
    fontFamily: 'System',
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  infoValue: {
    fontSize: 15,
    color: BLOOD_THEME.textPrimary,
    fontWeight: '500',
    textAlign: 'right',
    fontFamily: 'System',
    flexShrink: 1,
  },
  phoneLink: {
    color: BLOOD_THEME.primaryRed,
    textDecorationLine: 'underline',
  },
  editButton: {
    padding: 8,
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: BLOOD_THEME.secondary,
    marginVertical: 4,
  },
  bloodTypeDisplay: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bloodTypeValue: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'System',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: BLOOD_THEME.textPrimary,
    marginBottom: 2,
    fontFamily: 'System',
  },
  statusSubtitle: {
    fontSize: 13,
    color: BLOOD_THEME.textSecondary,
    fontFamily: 'System',
  },

  // Quick Actions
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 2,
  },
  actionText: {
    fontSize: 12,
    color: BLOOD_THEME.textSecondary,
    textAlign: 'center',
    fontFamily: 'System',
  },

  // Create Request Button
  createRequestButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: BLOOD_THEME.primaryRed,
    padding: 18,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: BLOOD_THEME.primaryRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  createRequestText: {
    color: BLOOD_THEME.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 10,
    fontFamily: 'System',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: BLOOD_THEME.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '40%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BLOOD_THEME.secondary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: BLOOD_THEME.textPrimary,
    fontFamily: 'System',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  editInput: {
    backgroundColor: BLOOD_THEME.surface,
    borderWidth: 1,
    borderColor: BLOOD_THEME.secondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    fontFamily: 'System',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: BLOOD_THEME.surface,
    borderWidth: 1,
    borderColor: BLOOD_THEME.secondary,
  },
  saveButton: {
    backgroundColor: BLOOD_THEME.primaryRed,
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: BLOOD_THEME.textSecondary,
    fontFamily: 'System',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: BLOOD_THEME.textOnPrimary,
    marginLeft: 8,
    fontFamily: 'System',
  },

  // Bottom Spacer
  bottomSpacer: {
    height: 30,
  },
});