import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        // Încărcăm preferința pentru Dark Mode din AsyncStorage
        const loadDarkModePreference = async () => {
            try {
                const darkModeValue = await AsyncStorage.getItem('isDarkMode');
                setIsDarkMode(darkModeValue === 'true');
            } catch (error) {
                console.error('Error loading dark mode preference:', error);
            }
        };
        loadDarkModePreference();
    }, []);

    const toggleDarkMode = async () => {
        try {
            const newDarkMode = !isDarkMode;
            setIsDarkMode(newDarkMode);
            await AsyncStorage.setItem('isDarkMode', newDarkMode.toString());
        } catch (error) {
            console.error('Error saving dark mode preference:', error);
        }
    };

    const theme = {
        isDarkMode,
        toggleDarkMode,
        colors: {
            background: isDarkMode ? '#1a1a1a' : '#FFFFFF',
            text: isDarkMode ? '#FFFFFF' : '#333333',
            secondaryText: isDarkMode ? '#CCCCCC' : '#666666',
            primary: '#556B2F',
            secondary: isDarkMode ? '#2d2d2d' : '#F8F8F8',
            border: isDarkMode ? '#404040' : '#DDDDDD',
            input: isDarkMode ? '#2d2d2d' : '#FFFFFF',
            inputText: isDarkMode ? '#FFFFFF' : '#333333',
            placeholder: isDarkMode ? '#999999' : '#000000',
            tabBar: isDarkMode ? '#1a1a1a' : '#FFFFFF',
            tabBarActive: '#556B2F',
            tabBarInactive: isDarkMode ? '#666666' : '#999999',
            modalBackground: isDarkMode ? '#2d2d2d' : '#FFFFFF',
            modalText: isDarkMode ? '#FFFFFF' : '#333333',
            error: '#ff4444',
            success: '#4CAF50',
        }
    };

    return (
        <ThemeContext.Provider value={theme}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}; 