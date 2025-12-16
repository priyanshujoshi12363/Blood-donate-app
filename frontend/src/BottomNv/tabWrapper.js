// TabScreenWrapper.js
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabScreenWrapper({ children }) {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[
      styles.container,
      { 
        paddingTop: insets.top,
        paddingBottom: Platform.OS === 'ios' ? 90 : 70 
      }
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});