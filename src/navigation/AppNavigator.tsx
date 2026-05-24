import {DarkTheme, NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  CalendarDays,
  Home,
  MessageCircle,
  Trophy,
  User,
} from 'lucide-react-native';
import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';

import {AppText} from '../components/ui/AppText';
import {useAuth} from '../context/AuthContext';
import {AuthScreen} from '../screens/auth/AuthScreen';
import {CompleteProfileScreen} from '../screens/auth/CompleteProfileScreen';
import {ChatScreen} from '../screens/chat/ChatScreen';
import {HomeScreen} from '../screens/home/HomeScreen';
import {LeaderboardScreen} from '../screens/leaderboard/LeaderboardScreen';
import {AdminMatchFormScreen} from '../screens/matches/AdminMatchFormScreen';
import {CreateMatchRequestScreen} from '../screens/matches/CreateMatchRequestScreen';
import {MatchDetailScreen} from '../screens/matches/MatchDetailScreen';
import {MatchGalleryScreen} from '../screens/matches/MatchGalleryScreen';
import {MatchesScreen} from '../screens/matches/MatchesScreen';
import {MediaViewerScreen} from '../screens/matches/MediaViewerScreen';
import {ProfileScreen} from '../screens/profile/ProfileScreen';
import {UserProfileScreen} from '../screens/profile/UserProfileScreen';
import {colors} from '../theme/theme';
import type {RootStackParamList, TabParamList} from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    border: colors.border,
    card: colors.surface,
    notification: colors.primaryAlt,
    primary: colors.primaryAlt,
    text: colors.text,
  },
};
const tabIcons: Record<
  keyof TabParamList,
  (props: {color: string; size: number}) => React.ReactNode
> = {
  Home: ({color, size}) => <Home color={color} size={size} />,
  Matches: ({color, size}) => <CalendarDays color={color} size={size} />,
  Chat: ({color, size}) => <MessageCircle color={color} size={size} />,
  Leaderboard: ({color, size}) => <Trophy color={color} size={size} />,
  Profile: ({color, size}) => <User color={color} size={size} />,
};

export function AppNavigator() {
  const {loading, session, profile} = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.primaryAlt} />
        <AppText muted style={styles.splashText}>
          Loading scoreboard
        </AppText>
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (!profile || profile.username.startsWith('player_')) {
    return <CompleteProfileScreen />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {backgroundColor: colors.background},
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: {color: colors.text, fontWeight: '800'},
          contentStyle: {backgroundColor: colors.background},
        }}>
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="MatchDetail"
          component={MatchDetailScreen}
          options={{title: 'Match'}}
        />
        <Stack.Screen
          name="CreateMatchRequest"
          component={CreateMatchRequestScreen}
          options={{title: 'Request Match'}}
        />
        <Stack.Screen
          name="UserProfile"
          component={UserProfileScreen}
          options={{title: 'Player Profile'}}
        />
        <Stack.Screen
          name="AdminMatchForm"
          component={AdminMatchFormScreen}
          options={{title: 'Admin Match'}}
        />
        <Stack.Screen
          name="MatchGallery"
          component={MatchGalleryScreen}
          options={{title: 'Gallery'}}
        />
        <Stack.Screen
          name="MediaViewer"
          component={MediaViewerScreen}
          options={{title: 'Media'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primaryAlt,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontWeight: '800',
        },
        tabBarIcon: tabIcons[route.name],
      })}>
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Matches" component={MatchesScreen} />
      <Tabs.Screen name="Chat" component={ChatScreen} />
      <Tabs.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

const styles = StyleSheet.create({
  splash: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  splashText: {
    marginTop: 12,
  },
});
