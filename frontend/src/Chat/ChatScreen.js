import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const API_BASE_URL =  'https://blood-donate-app-9c09.onrender.com'; // Change to your actual base UR

const ChatScreen = ({ route, navigation }) => {
  const { chatId, otherUserId, otherUserInfo } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const scrollViewRef = useRef();

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId && otherUserId) {
      loadMessages();
      // Set up polling for new messages every 5 seconds
      const interval = setInterval(loadMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [currentUserId, otherUserId]);

  const loadCurrentUser = async () => {
    try {
      const userId = await AsyncStorage.getItem('@user_id');
      setCurrentUserId(userId || '');
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      
      if (!token || !otherUserId) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/msg/messages/${otherUserId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        // Transform API messages to our format
        const transformedMessages = result.messages.map(msg => ({
          id: msg.id,
          text: msg.text,
          sender: msg.senderId === currentUserId ? 'me' : 'other',
          time: msg.timestamp,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
        }));
        
        setMessages(transformedMessages);
      } else {
        console.error('Failed to load messages:', result.message);
        Alert.alert('Error', result.message || 'Failed to load messages');
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Network Error', 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    try {
      const token = await AsyncStorage.getItem('@auth_token');
      const userId = await AsyncStorage.getItem('@user_id');
      
      if (!token || !userId) {
        Alert.alert('Error', 'Please login again');
        navigation.navigate('Login');
        return;
      }

      // Create temporary message for immediate UI update
      const tempMessage = {
        id: Date.now().toString(),
        text: messageText,
        sender: 'me',
        time: Date.now(),
        senderId: userId,
        receiverId: otherUserId,
        isTemp: true,
      };

      setMessages(prev => [...prev, tempMessage]);

      // Send to API
      const response = await fetch(`${API_BASE_URL}/msg/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverId: otherUserId,
          text: messageText,
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        // Remove temp message and add confirmed message
        setMessages(prev => {
          const filtered = prev.filter(msg => !msg.isTemp);
          const newMessage = {
            id: result.messageId || Date.now().toString(),
            text: messageText,
            sender: 'me',
            time: Date.now(),
            senderId: userId,
            receiverId: otherUserId,
          };
          return [...filtered, newMessage];
        });
        
        // Reload messages to get latest from server
        setTimeout(loadMessages, 500);
      } else {
        // Remove temp message on error
        setMessages(prev => prev.filter(msg => !msg.isTemp));
        Alert.alert('Error', result.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => !msg.isTemp));
      Alert.alert('Network Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();
    
    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const groupMessagesByDate = () => {
    const groups = {};
    messages.forEach(message => {
      const date = formatDate(message.time);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    return groups;
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

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={BLOOD_THEME.primaryRed} barStyle="light-content" />
      
      {/* Chat Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={BLOOD_THEME.textOnPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerUserInfo}>
          <View style={styles.headerAvatar}>
            {otherUserInfo?.profilePic?.url ? (
              <Image 
                source={{ uri: otherUserInfo.profilePic.url }} 
                style={styles.headerAvatarImage}
              />
            ) : (
              <View style={[styles.headerAvatarPlaceholder, { 
                backgroundColor: getBloodTypeColor(otherUserInfo?.bloodGroup) 
              }]}>
                <Text style={styles.headerAvatarText}>
                  {getInitials(otherUserInfo?.username)}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.headerUserDetails}>
            <Text style={styles.headerUserName} numberOfLines={1}>
              {otherUserInfo?.username || 'User'}
            </Text>
            <View style={styles.headerUserStatus}>
              {otherUserInfo?.bloodGroup && (
                <View style={styles.bloodGroupIndicator}>
                  <MaterialCommunityIcons name="water" size={12} color="#FFF" />
                  <Text style={styles.bloodGroupText}>
                    {otherUserInfo.bloodGroup}
                  </Text>
                </View>
              )}
              <Text style={styles.statusText}>
                {otherUserInfo?.isDonor ? 'Blood Donor' : 'Recipient'}
              </Text>
            </View>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.callButton}
          onPress={() => {
            if (otherUserInfo?.phone) {
              Alert.alert(
                'Call User',
                `Call ${otherUserInfo.username} at ${otherUserInfo.phone}?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Call', 
                    onPress: () => {
                      // In a real app, you would use Linking.openURL(`tel:${otherUserInfo.phone}`)
                      Alert.alert('Calling...', `Would call ${otherUserInfo.phone} in a real app`);
                    }
                  }
                ]
              );
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="call-outline" size={24} color={BLOOD_THEME.textOnPrimary} />
        </TouchableOpacity>
      </View>

      {/* Messages Area */}
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading && messages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BLOOD_THEME.primaryRed} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={styles.messagesContainer}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {Object.entries(groupMessagesByDate()).map(([date, dateMessages]) => (
                <View key={date}>
                  {/* Date Separator */}
                  <View style={styles.dateSeparator}>
                    <Text style={styles.dateText}>{date}</Text>
                  </View>

                  {/* Messages for this date */}
                  {dateMessages.map((message) => (
                    <View
                      key={message.id}
                      style={[
                        styles.messageBubble,
                        message.sender === 'me' ? styles.myMessage : styles.otherMessage,
                        message.isTemp && styles.tempMessage,
                      ]}
                    >
                      <Text style={[
                        styles.messageText,
                        message.sender === 'me' ? styles.myMessageText : styles.otherMessageText,
                      ]}>
                        {message.text}
                      </Text>
                      <View style={styles.messageFooter}>
                        <Text style={[
                          styles.messageTime,
                          message.sender === 'me' ? styles.myMessageTime : styles.otherMessageTime,
                        ]}>
                          {formatTime(message.time)}
                        </Text>
                        {message.sender === 'me' && (
                          <Ionicons 
                            name={message.isTemp ? "time-outline" : "checkmark"} 
                            size={12} 
                            color={message.isTemp ? BLOOD_THEME.textSecondary : BLOOD_THEME.success} 
                            style={styles.messageStatus}
                          />
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ))}

              {/* Empty state */}
              {messages.length === 0 && !loading && (
                <View style={styles.noMessagesContainer}>
                  <Ionicons name="chatbubble-outline" size={60} color={BLOOD_THEME.secondary} />
                  <Text style={styles.noMessagesTitle}>No messages yet</Text>
                  <Text style={styles.noMessagesSubtitle}>
                    Start the conversation with {otherUserInfo?.username || 'this user'}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Input Area */}
            <View style={styles.inputContainer}>
              <TouchableOpacity 
                style={styles.attachButton}
                onPress={() => Alert.alert('Coming Soon', 'Attachment feature coming soon!')}
              >
                <Ionicons name="attach-outline" size={24} color={BLOOD_THEME.textSecondary} />
              </TouchableOpacity>
              
              <TextInput
                style={styles.textInput}
                value={inputMessage}
                onChangeText={setInputMessage}
                placeholder="Type a message..."
                placeholderTextColor={BLOOD_THEME.textSecondary}
                multiline
                maxLength={1000}
                onSubmitEditing={sendMessage}
                blurOnSubmit={false}
              />
              
              {inputMessage.trim() ? (
                <TouchableOpacity
                  style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                  onPress={sendMessage}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={BLOOD_THEME.textOnPrimary} />
                  ) : (
                    <Ionicons 
                      name="send" 
                      size={24} 
                      color={BLOOD_THEME.textOnPrimary} 
                    />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.emojiButton}
                  onPress={() => Alert.alert('Coming Soon', 'Emoji picker coming soon!')}
                >
                  <Ionicons name="happy-outline" size={24} color={BLOOD_THEME.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLOOD_THEME.background,
  },
  
  // Header
  header: {
    backgroundColor: BLOOD_THEME.primaryRed,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  headerUserInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerAvatar: {
    marginRight: 12,
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: BLOOD_THEME.textOnPrimary,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BLOOD_THEME.textOnPrimary,
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: BLOOD_THEME.textOnPrimary,
    fontFamily: 'System',
  },
  headerUserDetails: {
    flex: 1,
  },
  headerUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: BLOOD_THEME.textOnPrimary,
    marginBottom: 2,
    fontFamily: 'System',
  },
  headerUserStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bloodGroupIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  bloodGroupText: {
    fontSize: 10,
    fontWeight: '600',
    color: BLOOD_THEME.textOnPrimary,
    marginLeft: 2,
    fontFamily: 'System',
  },
  statusText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: 'System',
  },
  callButton: {
    padding: 4,
  },

  // Keyboard Avoiding View
  keyboardView: {
    flex: 1,
  },

  // Loading
  loadingContainer: {
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

  // Messages Container
  messagesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 100,
  },
  dateSeparator: {
    alignSelf: 'center',
    backgroundColor: BLOOD_THEME.secondary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    color: BLOOD_THEME.textSecondary,
    fontWeight: '500',
    fontFamily: 'System',
  },

  // Message Bubbles
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 8,
  },
  tempMessage: {
    opacity: 0.7,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: BLOOD_THEME.primaryRed,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: BLOOD_THEME.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: BLOOD_THEME.secondary,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'System',
  },
  myMessageText: {
    color: BLOOD_THEME.textOnPrimary,
  },
  otherMessageText: {
    color: BLOOD_THEME.textPrimary,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
    fontFamily: 'System',
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  otherMessageTime: {
    color: BLOOD_THEME.textSecondary,
  },
  messageStatus: {
    marginLeft: 4,
  },

  // No Messages State
  noMessagesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noMessagesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: BLOOD_THEME.textPrimary,
    marginTop: 16,
    fontFamily: 'System',
  },
  noMessagesSubtitle: {
    fontSize: 14,
    color: BLOOD_THEME.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'System',
  },

  // Input Area
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BLOOD_THEME.background,
    borderTopWidth: 1,
    borderTopColor: BLOOD_THEME.secondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachButton: {
    padding: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: BLOOD_THEME.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 16,
    maxHeight: 100,
    minHeight: 40,
    borderWidth: 1,
    borderColor: BLOOD_THEME.secondary,
    fontFamily: 'System',
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BLOOD_THEME.primaryRed,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
});