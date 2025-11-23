import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';

type ActivationContextType = {
  activated: boolean;
  checkActivation: () => Promise<void>;
  logout: () => Promise<void>;
};

const ActivationContext = createContext<ActivationContextType | undefined>(undefined);

export function ActivationProvider({ children }: { children: ReactNode }) {
  const [activated, setActivated] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const checkActivation = async () => {
    try {
      const key = await SecureStore.getItemAsync('activationKey');
      setActivated(!!key);
    } catch (error) {
      console.error('Error checking activation:', error);
      setActivated(false);
    }
  };

  const logout = async () => {
    try {
      // Xóa tất cả dữ liệu activation
      await SecureStore.deleteItemAsync('activationKey');
      await SecureStore.deleteItemAsync('deviceId');
      await SecureStore.deleteItemAsync('deviceFingerprint');
      setActivated(false);
    } catch (error) {
      console.error('Error during logout:', error);
      // Vẫn set activated = false để đảm bảo logout thành công
      setActivated(false);
    }
  };

  useEffect(() => {
    checkActivation().finally(() => setIsReady(true));
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ActivationContext.Provider value={{ activated, checkActivation, logout }}>
      {children}
    </ActivationContext.Provider>
  );
}

export function useActivation() {
  const context = useContext(ActivationContext);
  if (context === undefined) {
    throw new Error('useActivation must be used within an ActivationProvider');
  }
  return context;
}

