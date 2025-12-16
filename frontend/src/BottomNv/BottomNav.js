// BottomTabNavigator.js - Fixed with Valid Icons
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Home from '../Home';
import YourRequest from '../Request/YourRequest';
import Chat from '../Chat/Chat';
import Profile from '../Profile';

const Tab = createBottomTabNavigator();

export default function BottomTabNavigator() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        // Ultra clean - no labels, just icons
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        
        // Very clean tab bar
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 60 + insets.bottom : 60,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        
        headerShown: false,
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={Home}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <View style={{ alignItems: 'center' }}>
              <Ionicons 
                name={focused ? "home" : "home-outline"} 
                size={28} 
                color={focused ? '#d32f2f' : '#999'} 
              />
              {focused && (
                <View style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#d32f2f',
                  marginTop: 4,
                }} />
              )}
            </View>
          ),
        }}
      />
      
      <Tab.Screen 
        name="Request" 
        component={YourRequest}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <View style={{ alignItems: 'center' }}>
              <MaterialCommunityIcons 
                name={focused ? "heart" : "heart-outline"}  // Fixed: valid icon name
                size={28} 
                color={focused ? '#d32f2f' : '#999'} 
              />
              {focused && (
                <View style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#d32f2f',
                  marginTop: 4,
                }} />
              )}
            </View>
          ),
        }}
      />
      
      <Tab.Screen 
        name="Chat" 
        component={Chat}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <View style={{ alignItems: 'center' }}>
              <Ionicons 
                name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} 
                size={28} 
                color={focused ? '#d32f2f' : '#999'} 
              />
              {focused && (
                <View style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#d32f2f',
                  marginTop: 4,
                }} />
              )}
            </View>
          ),
        }}
      />
      
      <Tab.Screen 
        name="Profile" 
        component={Profile}
        options={{
          tabBarIcon: ({ focused, color, size }) => (
            <View style={{ alignItems: 'center' }}>
              <Ionicons 
                name={focused ? "person" : "person-outline"} 
                size={28} 
                color={focused ? '#d32f2f' : '#999'} 
              />
              {focused && (
                <View style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#d32f2f',
                  marginTop: 4,
                }} />
              )}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}