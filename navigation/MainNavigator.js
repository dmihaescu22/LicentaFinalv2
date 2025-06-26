import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Image, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

import ExploreScreen from '../screens/ExploreScreen';
import ActivityScreen from '../screens/ActivityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import FeedScreen from '../screens/FeedScreen';
import BadgesScreen from '../screens/BadgesScreen';
import ChatsScreen from '../screens/ChatsScreen';
import GroupChatScreen from '../screens/GroupChatScreen';
import AddLiveUpdateScreen from '../screens/AddLiveUpdateScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function TabNavigator() {
  const { isDarkMode, colors } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Feed"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 65,
          paddingBottom: 10,
          paddingTop: 10,
          position: 'absolute',
          bottom: 25,
          left: 0,
          right: 0,
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        tabBarBackground: () => (
          <View
            style={{
              position: 'absolute',
              bottom: -25,
              left: 0,
              right: 0,
              height: 100,
              backgroundColor: colors.tabBar,
            }}
          />
        ),
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('../assets/icons/feed.png')}
              style={{
                width: 24,
                height: 24,
                tintColor: focused ? colors.primary : colors.tabBarInactive,
              }}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('../assets/icons/activity.png')}
              style={{
                width: 24,
                height: 24,
                tintColor: focused ? colors.primary : colors.tabBarInactive,
              }}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('../assets/icons/explore.png')}
              style={{
                width: 24,
                height: 24,
                tintColor: focused ? colors.primary : colors.tabBarInactive,
              }}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Badges"
        component={BadgesScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('../assets/icons/badges.png')}
              style={{
                width: 24,
                height: 24,
                tintColor: focused ? colors.primary : colors.tabBarInactive,
              }}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('../assets/icons/profile.png')}
              style={{
                width: 40,
                height: 40,
                tintColor: focused ? colors.primary : colors.tabBarInactive,
                marginBottom: -2
              }}
            />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Profile', { userId: undefined });
          },
        })}
      />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TabNavigator" component={TabNavigator} />
      <Stack.Screen name="ChatsScreen" component={ChatsScreen} />
      <Stack.Screen name="GroupChatScreen" component={GroupChatScreen} />
      <Stack.Screen name="AddLiveUpdate" component={AddLiveUpdateScreen} />
    </Stack.Navigator>
  );
}
