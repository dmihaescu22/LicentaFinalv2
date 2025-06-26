import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import MainNavigator from './MainNavigator';
import ChatsScreen from '../screens/ChatsScreen';
import GroupChatScreen from '../screens/GroupChatScreen';

const Stack = createStackNavigator();

export default function MainStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Main"
                component={MainNavigator}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="Chats"
                component={ChatsScreen}
                options={{
                    title: 'Conversații',
                    headerStyle: {
                        backgroundColor: '#556B2F',
                    },
                    headerTintColor: '#fff',
                }}
            />
            <Stack.Screen
                name="GroupChat"
                component={GroupChatScreen}
                options={({ route }) => ({
                    title: route.params?.chatName || 'Chat',
                    headerStyle: {
                        backgroundColor: '#556B2F',
                    },
                    headerTintColor: '#fff',
                })}
            />
        </Stack.Navigator>
    );
} 