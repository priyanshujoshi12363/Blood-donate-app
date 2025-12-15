import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Platform,
  StatusBar,
  SafeAreaView,
  useWindowDimensions,
} from "react-native";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";

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

export default function HomeScreen() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("blood");
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 375;

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

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#d32f2f" barStyle="light-content" />
      
      {/* HEADER WITH APP NAME */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={[styles.header, { paddingHorizontal: responsivePadding.horizontal }]}>
          <View>
            <Text style={[styles.appName, { fontSize: responsiveFont.xxlarge }]}>RapidDonor</Text>
            <Text style={[styles.userGreeting, { fontSize: responsiveFont.medium }]}>Hi, Priyanshu 👋</Text>
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
              <TouchableOpacity style={styles.menuItem}>
                <Ionicons name="person-outline" size={iconSize.small} color="#666" />
                <Text style={[styles.menuText, { fontSize: responsiveFont.medium }]}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem}>
                <MaterialIcons name="history" size={iconSize.small} color="#666" />
                <Text style={[styles.menuText, { fontSize: responsiveFont.medium }]}>History</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem}>
                <Ionicons name="settings-outline" size={iconSize.small} color="#666" />
                <Text style={[styles.menuText, { fontSize: responsiveFont.medium }]}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, styles.logoutItem]}>
                <Ionicons name="log-out-outline" size={iconSize.small} color="#ff4757" />
                <Text style={[styles.menuText, styles.logoutText, { fontSize: responsiveFont.medium }]}>Logout</Text>
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
          { paddingBottom: height * 0.12 } // Responsive bottom padding
        ]}
      >
        {/* PROFILE PREVIEW */}
        <View style={[styles.profileCard, { marginHorizontal: responsivePadding.horizontal }]}>
          <View style={styles.profileHeader}>
            <Ionicons name="person-circle" size={isSmallScreen ? 60 : 70} color="#d32f2f" />
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { fontSize: responsiveFont.large }]}>Priyanshu Joshi</Text>
              <Text style={[styles.profileBlood, { fontSize: responsiveFont.small }]}>
                Blood Group: <Text style={styles.bloodGroup}>B+</Text>
              </Text>
              <View style={styles.locationContainer}>
                <Ionicons name="location-outline" size={iconSize.small} color="#666" />
                <Text style={[styles.locationText, { fontSize: responsiveFont.small }]}>Mumbai, Maharashtra</Text>
              </View>
            </View>
          </View>
          <View style={styles.profileStats}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { fontSize: responsiveFont.xlarge }]}>5</Text>
              <Text style={[styles.statLabel, { fontSize: responsiveFont.small }]}>Donations</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { fontSize: responsiveFont.xlarge }]}>3</Text>
              <Text style={[styles.statLabel, { fontSize: responsiveFont.small }]}>Requests</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { fontSize: responsiveFont.xlarge }]}>12</Text>
              <Text style={[styles.statLabel, { fontSize: responsiveFont.small }]}>Lives Saved</Text>
            </View>
          </View>
        </View>

        {/* EMERGENCY BUTTON */}
        <TouchableOpacity style={[styles.emergencyBtn, { marginHorizontal: responsivePadding.horizontal }]}>
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

      {/* BOTTOM NAV BAR */}
      <SafeAreaView style={styles.bottomNavSafeArea}>
        <View style={[styles.bottomNav, { paddingBottom: Platform.OS === 'ios' ? height * 0.02 : 0 }]}>
          <TouchableOpacity 
            style={[styles.navItem, activeTab === 'blood' && styles.activeNavItem]}
            onPress={() => setActiveTab('blood')}
          >
            <Ionicons 
              name="water" 
              size={iconSize.medium} 
              color={activeTab === 'blood' ? '#d32f2f' : '#666'} 
            />
            <Text style={[styles.navText, 
              { fontSize: responsiveFont.small },
              activeTab === 'blood' && styles.activeNavText
            ]}>
              Blood
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navItem, activeTab === 'donations' && styles.activeNavItem]}
            onPress={() => setActiveTab('donations')}
          >
            <Ionicons 
              name="heart" 
              size={iconSize.medium} 
              color={activeTab === 'donations' ? '#d32f2f' : '#666'} 
            />
            <Text style={[styles.navText, 
              { fontSize: responsiveFont.small },
              activeTab === 'donations' && styles.activeNavText
            ]}>
              My Donations
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navItem, activeTab === 'requests' && styles.activeNavItem]}
            onPress={() => setActiveTab('requests')}
          >
            <Ionicons 
              name="list" 
              size={iconSize.medium} 
              color={activeTab === 'requests' ? '#d32f2f' : '#666'} 
            />
            <Text style={[styles.navText, 
              { fontSize: responsiveFont.small },
              activeTab === 'requests' && styles.activeNavText
            ]}>
              Requests
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navItem, activeTab === 'profile' && styles.activeNavItem]}
            onPress={() => setActiveTab('profile')}
          >
            <Ionicons 
              name="person" 
              size={iconSize.medium} 
              color={activeTab === 'profile' ? '#d32f2f' : '#666'} 
            />
            <Text style={[styles.navText, 
              { fontSize: responsiveFont.small },
              activeTab === 'profile' && styles.activeNavText
            ]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    marginTop: 4,
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