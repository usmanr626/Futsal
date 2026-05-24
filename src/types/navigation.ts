import type {NavigatorScreenParams} from '@react-navigation/native';

import type {MatchStatus, MediaType} from './domain';

export type MatchesTab = 'upcoming' | 'previous' | 'requests';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<TabParamList> | undefined;
  MatchDetail: {matchId: string};
  CreateMatchRequest: {requestId?: string} | undefined;
  UserProfile: {userId: string};
  AdminMatchForm: {matchId?: string; initialStatus?: MatchStatus} | undefined;
  MatchGallery: {matchId: string};
  MediaViewer: {mediaId: string; mediaType: MediaType};
};

export type TabParamList = {
  Home: undefined;
  Matches: {initialTab?: MatchesTab} | undefined;
  Chat: undefined;
  Leaderboard: undefined;
  Profile: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
