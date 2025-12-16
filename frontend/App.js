// App.js - Complete solution to hide navigation bars
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StatusBar, View } from 'react-native';
import Login from './src/Login';
import Register from './src/Register';
import BottomTabNavigator from './src/BottomNv/BottomNav';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Hide Android navigation bar
      try {
        const NavigationBar = require('react-native-navigation-bar-color');
        NavigationBar.setNavigationBarColor('#ffffff', false, false);
        NavigationBar.hideNavigationBar();
      } catch (e) {
        console.log('Navigation bar package not available');
      }
    }
  }, []);

  return (
    <SafeAreaProvider>
      {/* iOS Status Bar */}
      <StatusBar 
        backgroundColor="#d32f2f" 
        barStyle="light-content"
        hidden={Platform.OS === 'android'} // Hide on Android
      />
      
      <View style={{ 
        flex: 1, 
        backgroundColor: '#f5f5f5',
        // Hide home indicator on iOS
        paddingBottom: Platform.OS === 'ios' ? 0 : 0
      }}>
        <NavigationContainer>
          <Stack.Navigator 
            initialRouteName="Login"
            screenOptions={{ 
              headerShown: false,
              // iOS specific: hide home indicator
              ...(Platform.OS === 'ios' && {
                gestureEnabled: false,
                animation: 'none',
              })
            }}
          >
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="Register" component={Register} />
            <Stack.Screen name="Main" component={BottomTabNavigator} />
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}