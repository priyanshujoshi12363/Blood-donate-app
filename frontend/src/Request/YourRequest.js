import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const API_BASE_URL = 'https://blood-donate-app-9c09.onrender.com';

const YourRequest = ({ navigation }) => {
  const [requests, setRequests] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  /* =======================
     1️⃣ LOAD USER ID
     ======================= */
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const stored = await AsyncStorage.getItem('@user_data');
        if (!stored) {
          setError('User not logged in');
          setLoading(false);
          return;
        }
        const parsed = JSON.parse(stored);
        setUserId(parsed._id);
      } catch (err) {
        console.error(err);
        setError('Failed to load user');
        setLoading(false);
      }
    };

    loadUserId();
  }, []);

  /* =======================
     2️⃣ FETCH REQUESTS
     ======================= */
  const fetchRequests = useCallback(async () => {
    if (!userId) return;

    try {
      setError(null);

      const response = await fetch(`${API_BASE_URL}/user/blood`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Sort by creation date (newest first)
        const sortedRequests = (data.data || []).sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setRequests(sortedRequests);
      } else {
        setRequests([]);
        setError('Failed to fetch requests');
      }
    } catch (err) {
      console.error(err);
      setError('Network error. Please check your connection');
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  /* =======================
     3️⃣ AUTO FETCH
     ======================= */
  useEffect(() => {
    if (userId) fetchRequests();
  }, [userId, fetchRequests]);

  /* =======================
     4️⃣ PULL TO REFRESH
     ======================= */
  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  /* =======================
     5️⃣ UTILITY FUNCTIONS
     ======================= */
  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
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

  const getStatusColor = (request) => {
    const now = new Date();
    const expiresAt = new Date(request.expiresAt);
    const isExpired = expiresAt < now;
    const hasDonations = request.donations && request.donations.length > 0;

    if (hasDonations) return '#45B7D1'; // Blue for accepted
    if (isExpired) return '#95A5A6'; // Gray for expired
    return '#4ECDC4'; // Green for active
  };

  const getStatusText = (request) => {
    const now = new Date();
    const expiresAt = new Date(request.expiresAt);
    const isExpired = expiresAt < now;
    const hasDonations = request.donations && request.donations.length > 0;

    if (hasDonations) return 'Accepted';
    if (isExpired) return 'Expired';
    return 'Active';
  };

  const getStatusIcon = (request) => {
    const hasDonations = request.donations && request.donations.length > 0;
    const now = new Date();
    const expiresAt = new Date(request.expiresAt);
    const isExpired = expiresAt < now;

    if (hasDonations) return 'checkmark-circle';
    if (isExpired) return 'time-outline';
    return 'pulse';
  };

  const formatPhone = (phone) => {
    if (!phone) return '';
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  };

  /* =======================
     UI STATES
     ======================= */
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar backgroundColor="#D32F2F" barStyle="light-content" />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#D32F2F" />
          <Text style={styles.loadingText}>Loading your blood requests...</Text>
        </View>
      </View>
    );
  }

  if (error && requests.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar backgroundColor="#D32F2F" barStyle="light-content" />
        <View style={styles.errorContent}>
          <Ionicons name="alert-circle-outline" size={80} color="#FF5252" />
          <Text style={styles.errorTitle}>Oops!</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchRequests}>
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* =======================
     MAIN UI
     ======================= */
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#D32F2F" barStyle="light-content" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Your Blood Requests</Text>
          <Text style={styles.headerSubtitle}>
            {requests.length} request{requests.length !== 1 ? 's' : ''}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => navigation.navigate('CreateRequest')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="add-circle" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#D32F2F"
            colors={['#D32F2F']}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* EMPTY STATE */}
        {requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="water-outline" size={80} color="#E0E0E0" />
            </View>
            <Text style={styles.emptyTitle}>No Blood Requests</Text>
            <Text style={styles.emptySubtitle}>
              You haven't created any blood requests yet
            </Text>
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={() => navigation.navigate('Request')}
            >
              <Ionicons name="add-circle" size={22} color="#FFF" />
              <Text style={styles.createFirstText}>Create First Request</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // REQUEST LIST
          <View style={styles.requestsContainer}>
            {requests.map((request) => {
              const statusColor = getStatusColor(request);
              const statusText = getStatusText(request);
              const statusIcon = getStatusIcon(request);
              const hasDonations = request.donations && request.donations.length > 0;

              return (
                <View key={request._id} style={styles.requestCard}>
                  {/* CARD HEADER */}
                  <View style={styles.cardHeader}>
                    <View style={styles.bloodTypeContainer}>
                      <View style={[styles.bloodTypeBadge, { backgroundColor: `${statusColor}15` }]}>
                        <Ionicons name="water" size={18} color={statusColor} />
                        <Text style={[styles.bloodType, { color: statusColor }]}>
                          {request.BloodType}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.statusContainer}>
                      <Ionicons name={statusIcon} size={16} color={statusColor} />
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {statusText}
                      </Text>
                    </View>
                  </View>

                  {/* CARD CONTENT */}
                  <View style={styles.cardContent}>
                    <View style={styles.detailRow}>
                      <Ionicons name="medical-outline" size={18} color="#666" />
                      <Text style={styles.detailText} numberOfLines={2}>
                        {request.HospitalAddress}
                      </Text>
                    </View>
                    
                    <View style={styles.detailRow}>
                      <Ionicons name="cube-outline" size={18} color="#666" />
                      <Text style={styles.detailText}>
                        {request.unitRequired} unit{request.unitRequired !== 1 ? 's' : ''} required
                      </Text>
                    </View>
                    
                    <View style={styles.detailRow}>
                      <Ionicons name="call-outline" size={18} color="#666" />
                      <Text style={styles.detailText}>{formatPhone(request.ContactPhone)}</Text>
                    </View>
                    
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={18} color="#666" />
                      <Text style={styles.detailText}>
                        Created {getTimeAgo(request.createdAt)}
                      </Text>
                    </View>

                    {/* DONORS SECTION (if any) */}
                    {hasDonations && (
                      <View style={styles.donorsContainer}>
                        <View style={styles.donorsBadge}>
                          <Ionicons name="people" size={14} color="#45B7D1" />
                          <Text style={styles.donorsText}>
                            {request.donations.length} donor{request.donations.length !== 1 ? 's' : ''} accepted
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* CARD FOOTER */}
                  <View style={styles.cardFooter}>
                    <TouchableOpacity style={styles.viewDetailsButton}>
                      <Text style={styles.viewDetailsText}>View Details</Text>
                      <Ionicons name="chevron-forward" size={16} color="#1976D2" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* CREATE NEW BUTTON */}
        {requests.length > 0 && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('CreateRequest')}
            activeOpacity={0.9}
          >
            <Ionicons name="add-circle" size={22} color="#FFF" />
            <Text style={styles.createButtonText}>Create New Request</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default YourRequest;

/* =======================
   STYLES
   ======================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  
  // Header
  header: {
    backgroundColor: '#D32F2F',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'System',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'System',
  },
  addButton: {
    padding: 4,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontFamily: 'System',
  },

  // Error
  errorContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'System',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    fontFamily: 'System',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 2,
  },
  retryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
    color: '#333',
    marginBottom: 8,
    fontFamily: 'System',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    fontFamily: 'System',
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  createFirstText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'System',
  },

  // Requests Container
  requestsContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // Request Card
  requestCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  bloodTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bloodTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  bloodType: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 6,
    fontFamily: 'System',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    fontFamily: 'System',
  },
  cardContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 15,
    color: '#555',
    marginLeft: 12,
    flex: 1,
    fontFamily: 'System',
  },
  donorsContainer: {
    marginTop: 8,
  },
  donorsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  donorsText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: 'System',
  },
  cardFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDetailsText: {
    color: '#1976D2',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 4,
    fontFamily: 'System',
  },

  // Create Button
  createButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: '#D32F2F',
    padding: 18,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 10,
    fontFamily: 'System',
  },

  // Bottom Spacer
  bottomSpacer: {
    height: 30,
  },
});