import {useEffect} from 'react';

import {useAuth} from '../../context/AuthContext';
import {setupPushNotifications} from '../../services/pushService';

export function PushNotificationRegistrar() {
  const {session} = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    return setupPushNotifications(userId);
  }, [userId]);

  return null;
}
