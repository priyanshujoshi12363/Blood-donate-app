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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

// Theme Colors
const BLOOD_THEME = {
  primaryRed: '#D32F2F',
  primaryLight: '#FF5252',
  primaryDark: '#9A0007',
  secondary: '#FFEBEE',
  success: '#4CAF50',
  error: '#F44336',
  background: '#FFFFFF',
  surface: '#F5F5F5',
  textPrimary: '#212121',
  textSecondary: '#757575',
  textOnPrimary: '#FFFFFF',
};

const API_BASE_URL = 'https://blood-donate-app-9c09.onrender.com'; // Change to your actual base URL

const Chat = ({ navigation }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState({});

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      const userId = await AsyncStorage.getItem('@user_id');
      
      if (!token || !userId) {
        Alert.alert('Error', 'Please login again');
        navigation.navigate('Login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/msg/my-chats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setChats(result.chats || []);
        await fetchUsersData(result.chats, token);
      } else {
        Alert.alert('Error', result.message || 'Failed to load chats');
        setChats([]);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      Alert.alert('Network Error', 'Failed to load chats');
      setChats([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUsersData = async (chatsArray, token) => {
    const userDataMap = {};
    
    for (const chat of chatsArray) {
      if (chat.withUser && !userDataMap[chat.withUser]) {
        try {
          const response = await fetch(`${API_BASE_URL}/msg/${chat.withUser}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          const result = await response.json();
          if (response.ok && result.success) {
            userDataMap[chat.withUser] = result.data;
          }
        } catch (error) {
          console.error(`Error fetching user ${chat.withUser}:`, error);
        }
      }
    }
    
    setUserData(userDataMap);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadChats();
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  const getBloodTypeColor = (bloodGroup) => {
    if (!bloodGroup) return BLOOD_THEME.primaryRed;
    const type = bloodGroup.charAt(0);
    switch(type) {
      case 'A': return '#FF6B6B';
      case 'B': return '#4ECDC4';
      case 'O': return '#FFD166';
      case 'A': return '#9C27B0';
      default: return BLOOD_THEME.primaryRed;
    }
  };

  const handleChatPress = (chat, userInfo) => {
    navigation.navigate('ChatScreen', {
      chatId: chat.chatId,
      otherUserId: chat.withUser,
      otherUserInfo: userInfo,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar backgroundColor={BLOOD_THEME.primaryRed} barStyle="light-content" />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={BLOOD_THEME.primaryRed} />
          <Text style={styles.loadingText}>Loading chats...</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={BLOOD_THEME.primaryRed} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={BLOOD_THEME.textOnPrimary} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Messages</Text>
        
        <TouchableOpacity 
          style={styles.newChatButton}
          onPress={() => Alert.alert('Coming Soon', 'New chat feature coming soon!')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="add-circle-outline" size={24} color={BLOOD_THEME.textOnPrimary} />
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
        {/* Empty State */}
        {chats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="chatbubbles-outline" size={80} color="#E0E0E0" />
            </View>
            <Text style={styles.emptyTitle}>No Messages Yet</Text>
            <Text style={styles.emptySubtitle}>
              Start a conversation with blood donors or recipients
            </Text>
            <TouchableOpacity
              style={styles.startChatButton}
              onPress={() => Alert.alert('Coming Soon', 'Find donors feature coming soon!')}
            >
              <Ionicons name="search" size={22} color="#FFF" />
              <Text style={styles.startChatText}>Find Donors</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Chat List
          <View style={styles.chatsContainer}>
            {chats.map((chat) => {
              const userInfo = userData[chat.withUser] || {};
              const bloodGroupColor = getBloodTypeColor(userInfo.bloodGroup);
              
              return (
                <TouchableOpacity
                  key={chat.chatId}
                  style={styles.chatCard}
                  onPress={() => handleChatPress(chat, userInfo)}
                  activeOpacity={0.7}
                >
                  {/* User Avatar */}
                  <View style={styles.avatarContainer}>
                    {userInfo.profilePic?.url ? (
                      <Image 
                        source={{ uri: userInfo.profilePic.url }} 
                        style={styles.avatarImage}
                      />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: bloodGroupColor }]}>
                        <Text style={styles.avatarText}>
                          {getInitials(userInfo.username)}
                        </Text>
                      </View>
                    )}
                    {userInfo.isDonor && (
                      <View style={styles.donorBadge}>
                        <MaterialCommunityIcons name="water" size={10} color="#FFF" />
                      </View>
                    )}
                  </View>
                  
                  {/* Chat Content */}
                  <View style={styles.chatContent}>
                    <View style={styles.chatHeader}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {userInfo.username || 'Unknown User'}
                      </Text>
                      <Text style={styles.chatTime}>
                        {formatTime(chat.lastMessageTime)}
                      </Text>
                    </View>
                    
                    <Text style={styles.lastMessage} numberOfLines={2}>
                      {chat.lastMessage || 'Start a conversation...'}
                    </Text>
                    
                    {/* User Info Row */}
                    <View style={styles.userInfoRow}>
                      {userInfo.bloodGroup && (
                        <View style={[styles.bloodGroupBadge, { backgroundColor: bloodGroupColor + '20' }]}>
                          <MaterialCommunityIcons name="water" size={12} color={bloodGroupColor} />
                          <Text style={[styles.bloodGroupText, { color: bloodGroupColor }]}>
                            {userInfo.bloodGroup}
                          </Text>
                        </View>
                      )}
                      
                      {userInfo.age && (
                        <View style={styles.infoBadge}>
                          <Ionicons name="calendar-outline" size={12} color={BLOOD_THEME.textSecondary} />
                          <Text style={styles.infoText}>{userInfo.age} yrs</Text>
                        </View>
                      )}
                      
                      {userInfo.gender && (
                        <View style={styles.infoBadge}>
                          <MaterialCommunityIcons 
                            name={userInfo.gender === 'male' ? 'gender-male' : 'gender-female'} 
                            size={12} 
                            color={BLOOD_THEME.textSecondary} 
                          />
                          <Text style={styles.infoText}>
                            {userInfo.gender === 'male' ? 'Male' : 'Female'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  {/* Unread Indicator */}
                  {chat.unread > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{chat.unread}</Text>
                    </View>
                  )}
                  
                  {/* Forward Arrow */}
                  <Ionicons name="chevron-forward" size={20} color={BLOOD_THEME.textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default Chat;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLOOD_THEME.background,
  },
  
  // Header
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
  newChatButton: {
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
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: BLOOD_THEME.textPrimary,
    marginBottom: 8,
    fontFamily: 'System',
  },
  emptySubtitle: {
    fontSize: 16,
    color: BLOOD_THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    fontFamily: 'System',
  },
  startChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BLOOD_THEME.primaryRed,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    elevation: 4,
    shadowColor: BLOOD_THEME.primaryRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  startChatText: {
    color: BLOOD_THEME.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'System',
  },

  // Chats Container
  chatsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Chat Card
  chatCard: {
    backgroundColor: BLOOD_THEME.surface,
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: BLOOD_THEME.secondary,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: BLOOD_THEME.background,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BLOOD_THEME.background,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: BLOOD_THEME.textOnPrimary,
    fontFamily: 'System',
  },
  donorBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: BLOOD_THEME.primaryRed,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BLOOD_THEME.background,
  },
  chatContent: {
    flex: 1,
    marginRight: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: BLOOD_THEME.textPrimary,
    flex: 1,
    fontFamily: 'System',
  },
  chatTime: {
    fontSize: 12,
    color: BLOOD_THEME.textSecondary,
    marginLeft: 8,
    fontFamily: 'System',
  },
  lastMessage: {
    fontSize: 14,
    color: BLOOD_THEME.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: 'System',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  bloodGroupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  bloodGroupText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
    fontFamily: 'System',
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BLOOD_THEME.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 11,
    color: BLOOD_THEME.textSecondary,
    marginLeft: 4,
    fontFamily: 'System',
  },
  unreadBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: BLOOD_THEME.primaryRed,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: BLOOD_THEME.textOnPrimary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'System',
  },

  // Bottom Spacer
  bottomSpacer: {
    height: 30,
  },
});