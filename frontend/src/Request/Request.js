import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  TOKEN: '@auth_token',
  USER_ID: '@user_id',
  USER_DATA: '@user_data',
};

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function Request({ navigation }) {
  const [bloodType, setBloodType] = useState('A+');
  const [description, setDescription] = useState('');
  const [unitRequired, setUnitRequired] = useState('1');
  const [contactPhone, setContactPhone] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userPhone, setUserPhone] = useState('');
  const [userData, setUserData] = useState(null);
  
  // Autocomplete states
  const [addressQuery, setAddressQuery] = useState('');
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [isFetchingAutocomplete, setIsFetchingAutocomplete] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);

  // Load user data on component mount
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userDataStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (userDataStr) {
        const data = JSON.parse(userDataStr);
        setUserData(data);
        setContactPhone(data.phone || '');
        setUserPhone(data.phone || '');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // Fetch autocomplete results
  const fetchAutocompleteResults = async (query) => {
    if (!query || query.trim().length < 2) {
      setAutocompleteResults([]);
      return;
    }

    setIsFetchingAutocomplete(true);
    try {
      const response = await fetch(
        `https://blood-donate-app-9c09.onrender.com/map/search?input=${encodeURIComponent(query.trim())}`
      );
      
      if (response.ok) {
        const data = await response.json();
        // Handle different response formats
        const results = data.predictions || data.results || data.data || data;
        setAutocompleteResults(Array.isArray(results) ? results.slice(0, 5) : []);
        setShowAutocomplete(true);
      } else {
        console.error('Autocomplete API error:', response.status);
        setAutocompleteResults([]);
      }
    } catch (error) {
      console.error('Autocomplete fetch error:', error);
      setAutocompleteResults([]);
    } finally {
      setIsFetchingAutocomplete(false);
    }
  };

  // Handle address input change with debounce
  const handleAddressChange = (text) => {
    setAddressQuery(text);
    setHospitalAddress(text);
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for debounced search
    if (text.trim().length >= 2) {
      const timeout = setTimeout(() => {
        fetchAutocompleteResults(text);
      }, 500); // 500ms debounce
      setSearchTimeout(timeout);
    } else {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
    }
  };

  // Handle address selection from autocomplete
  const handleAddressSelect = (address) => {
    // Extract address text based on different possible formats
    let selectedAddress = '';
    if (typeof address === 'string') {
      selectedAddress = address;
    } else if (address.description) {
      selectedAddress = address.description;
    } else if (address.formatted_address) {
      selectedAddress = address.formatted_address;
    } else if (address.name) {
      selectedAddress = address.name;
    } else if (address.address) {
      selectedAddress = address.address;
    } else {
      selectedAddress = JSON.stringify(address);
    }
    
    setHospitalAddress(selectedAddress);
    setAddressQuery(selectedAddress);
    setShowAutocomplete(false);
    setAutocompleteResults([]);
  };

  // Render autocomplete item
  const renderAutocompleteItem = ({ item }) => {
    let title = '';
    let subtitle = '';
    
    // Handle different response formats
    if (typeof item === 'string') {
      title = item;
    } else if (item.description) {
      title = item.description;
      subtitle = item.structured_formatting?.secondary_text || '';
    } else if (item.formatted_address) {
      title = item.formatted_address;
    } else if (item.name) {
      title = item.name;
      subtitle = item.vicinity || '';
    } else if (item.address) {
      title = item.address;
    } else {
      title = JSON.stringify(item);
    }
    
    return (
      <TouchableOpacity
        style={styles.autocompleteItem}
        onPress={() => handleAddressSelect(item)}
      >
        <MaterialCommunityIcons name="map-marker" size={20} color="#666" style={styles.autocompleteIcon} />
        <View style={styles.autocompleteTextContainer}>
          <Text style={styles.autocompleteTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={styles.autocompleteSubtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const validateForm = () => {
    if (!bloodType.trim()) {
      Alert.alert('Error', 'Please select blood type');
      return false;
    }
    
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter description');
      return false;
    }
    
    if (!unitRequired.trim() || parseInt(unitRequired) <= 0) {
      Alert.alert('Error', 'Please enter valid number of units (min 1)');
      return false;
    }
    
    if (!contactPhone.trim() || contactPhone.length !== 10) {
      Alert.alert('Error', 'Please enter valid 10-digit contact phone');
      return false;
    }
    
    if (!hospitalAddress.trim()) {
      Alert.alert('Error', 'Please enter hospital address');
      return false;
    }
    
    return true;
  };

  const handleSubmitRequest = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      // Get token from AsyncStorage
      const token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
      
      if (!token) {
        Alert.alert('Error', 'Please login again');
        navigation.replace('Login');
        return;
      }

      // Prepare request data
      const requestData = {
        BloodType: bloodType,
        Description: description.trim(),
        unitRequired: `${unitRequired} unit${parseInt(unitRequired) > 1 ? 's' : ''}`,
        ContactPhone: contactPhone.trim(),
        HospitalAddress: hospitalAddress.trim(),
      };

      console.log('Sending request data:', requestData);

      // Make API call
      const response = await fetch('https://blood-donate-app-9c09.onrender.com/blood/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();
      console.log('API Response:', data);

      if (response.ok) {
        Alert.alert(
          'Request Submitted! 🎉',
          'Your blood request has been sent to nearby donors.',
          [
            {
              text: 'View Status',
              onPress: () => {
                navigation.navigate('Home');
              }
            },
            {
              text: 'Make Another',
              onPress: () => {
                // Clear form for another request
                setDescription('');
                setUnitRequired('1');
                setHospitalAddress('');
                setAddressQuery('');
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Submission Failed',
          data.message || 'Something went wrong. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Request error:', error);
      Alert.alert(
        'Network Error',
        'Unable to connect to server. Please check your connection.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseMyNumber = () => {
    if (userPhone) {
      setContactPhone(userPhone);
    } else {
      Alert.alert('Info', 'Your phone number is not available in profile');
    }
  };

  const handleEmergencyRequest = () => {
    Alert.alert(
      'Emergency Request',
      'This will mark your request as URGENT and notify all nearby donors immediately. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Send Emergency',
          style: 'destructive',
          onPress: () => {
            // Add URGENT to description
            if (!description.toLowerCase().includes('urgent')) {
              setDescription(`URGENT: ${description}`);
            }
            handleSubmitRequest();
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#d32f2f" barStyle="light-content" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Request Blood</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Request Form */}
          <View style={styles.formContainer}>
            <View style={styles.infoCard}>
              <MaterialCommunityIcons name="information" size={24} color="#1976d2" />
              <Text style={styles.infoText}>
                Fill this form to request blood donation. Nearby donors will be notified immediately.
              </Text>
            </View>

            {/* Blood Type Selection */}
            <View style={styles.inputSection}>
              <Text style={styles.label}>
                <MaterialCommunityIcons name="water" size={16} color="#d32f2f" /> Required Blood Type
              </Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={bloodType}
                  onValueChange={(itemValue) => setBloodType(itemValue)}
                  style={styles.picker}
                >
                  {bloodGroups.map((group) => (
                    <Picker.Item key={group} label={group} value={group} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Description */}
            <View style={styles.inputSection}>
              <Text style={styles.label}>
                <MaterialCommunityIcons name="text" size={16} color="#d32f2f" /> Description
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe why blood is needed (e.g., surgery, accident, medical condition)"
                placeholderTextColor="#999"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>{description.length}/500</Text>
            </View>

            {/* Units Required */}
            <View style={styles.inputSection}>
              <Text style={styles.label}>
                <MaterialCommunityIcons name="numeric" size={16} color="#d32f2f" /> Units Required
              </Text>
              <View style={styles.unitContainer}>
                <TouchableOpacity
                  style={styles.unitButton}
                  onPress={() => {
                    const current = parseInt(unitRequired) || 1;
                    if (current > 1) setUnitRequired((current - 1).toString());
                  }}
                >
                  <MaterialCommunityIcons name="minus" size={24} color="#d32f2f" />
                </TouchableOpacity>
                
                <TextInput
                  style={styles.unitInput}
                  value={unitRequired}
                  onChangeText={setUnitRequired}
                  keyboardType="numeric"
                  maxLength={2}
                />
                
                <TouchableOpacity
                  style={styles.unitButton}
                  onPress={() => {
                    const current = parseInt(unitRequired) || 1;
                    if (current < 10) setUnitRequired((current + 1).toString());
                  }}
                >
                  <MaterialCommunityIcons name="plus" size={24} color="#d32f2f" />
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>Each unit is approximately 450ml of blood</Text>
            </View>

            {/* Contact Phone */}
            <View style={styles.inputSection}>
              <Text style={styles.label}>
                <MaterialCommunityIcons name="phone" size={16} color="#d32f2f" /> Contact Phone
              </Text>
              <View style={styles.phoneContainer}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Contact phone number"
                  placeholderTextColor="#999"
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <TouchableOpacity 
                  style={styles.useMyNumberButton}
                  onPress={handleUseMyNumber}
                >
                  <Text style={styles.useMyNumberText}>Use My Number</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>Donors will contact this number</Text>
            </View>

            {/* Hospital Address with Autocomplete */}
            <View style={styles.inputSection}>
              <Text style={styles.label}>
                <MaterialCommunityIcons name="hospital" size={16} color="#d32f2f" /> Hospital Address
              </Text>
              
              <View style={styles.autocompleteContainer}>
                <View style={styles.addressInputContainer}>
                  <TextInput
                    style={[styles.input, styles.addressInput]}
                    placeholder="Start typing hospital name or address..."
                    placeholderTextColor="#999"
                    value={addressQuery}
                    onChangeText={handleAddressChange}
                    onFocus={() => {
                      if (autocompleteResults.length > 0 && addressQuery.length >= 2) {
                        setShowAutocomplete(true);
                      }
                    }}
                  />
                  {isFetchingAutocomplete && (
                    <ActivityIndicator size="small" color="#d32f2f" style={styles.autocompleteLoader} />
                  )}
                </View>
                
                {/* Autocomplete Results */}
                {showAutocomplete && autocompleteResults.length > 0 && (
                  <View style={styles.autocompleteResultsContainer}>
                    <FlatList
                      data={autocompleteResults}
                      renderItem={renderAutocompleteItem}
                      keyExtractor={(item, index) => 
                        item.place_id || item.id || `address-${index}`
                      }
                      style={styles.autocompleteList}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                    />
                  </View>
                )}
                
                {/* No Results Message */}
                {showAutocomplete && addressQuery.length >= 2 && autocompleteResults.length === 0 && !isFetchingAutocomplete && (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>No addresses found</Text>
                  </View>
                )}
              </View>
              
              {/* Selected Address Preview */}
              {hospitalAddress && !showAutocomplete && (
                <View style={styles.selectedAddressContainer}>
                  <MaterialCommunityIcons name="check-circle" size={16} color="#2e7d32" />
                  <Text style={styles.selectedAddressText} numberOfLines={2}>
                    {hospitalAddress}
                  </Text>
                </View>
              )}
            </View>

            {/* Submit Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.submitButton, styles.normalButton]}
                onPress={handleSubmitRequest}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="send" size={20} color="#fff" />
                    <Text style={styles.submitButtonText}>Submit Request</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, styles.emergencyButton]}
                onPress={handleEmergencyRequest}
                disabled={isLoading}
              >
                <MaterialCommunityIcons name="alert-circle" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Emergency Request</Text>
              </TouchableOpacity>
            </View>

            {/* Guidelines */}
            <View style={styles.guidelinesContainer}>
              <Text style={styles.guidelinesTitle}>📋 Request Guidelines:</Text>
              <Text style={styles.guidelineItem}>• Be specific about the medical need</Text>
              <Text style={styles.guidelineItem}>• Provide accurate hospital address</Text>
              <Text style={styles.guidelineItem}>• Keep phone available for donor calls</Text>
              <Text style={styles.guidelineItem}>• Use emergency only for critical needs</Text>
              <Text style={styles.guidelineItem}>• Update status if blood is received</Text>
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
    paddingBottom: 30,
  },
  header: {
    backgroundColor: '#d32f2f',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  formContainer: {
    padding: 20,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    color: '#1976d2',
    fontSize: 14,
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 15,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  unitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffebee',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d32f2f',
  },
  unitInput: {
    width: 80,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginHorizontal: 10,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d32f2f',
    backgroundColor: '#fff',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  useMyNumberButton: {
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1976d2',
  },
  useMyNumberText: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  normalButton: {
    backgroundColor: '#d32f2f',
  },
  emergencyButton: {
    backgroundColor: '#ff4757',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  guidelinesContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  guidelineItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    marginLeft: 8,
  },
  // Autocomplete styles
  autocompleteContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  addressInputContainer: {
    position: 'relative',
  },
  addressInput: {
    paddingRight: 40,
  },
  autocompleteLoader: {
    position: 'absolute',
    right: 10,
    top: 12,
  },
  autocompleteResultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    marginTop: 4,
    maxHeight: 200,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1001,
  },
  autocompleteList: {
    maxHeight: 200,
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  autocompleteIcon: {
    marginRight: 10,
  },
  autocompleteTextContainer: {
    flex: 1,
  },
  autocompleteTitle: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  autocompleteSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  noResultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    marginTop: 4,
    padding: 15,
    elevation: 5,
    zIndex: 1001,
  },
  noResultsText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  selectedAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  selectedAddressText: {
    flex: 1,
    marginLeft: 8,
    color: '#2e7d32',
    fontSize: 14,
  },
});