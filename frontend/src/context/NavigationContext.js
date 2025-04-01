import React, { createContext, useContext, useState } from 'react';

const NavigationContext = createContext();

export const useNavigation = () => {
  return useContext(NavigationContext);
};

export const NavigationProvider = ({ children }) => {
  const [isNavVisible, setIsNavVisible] = useState(true);

  const hideNav = () => setIsNavVisible(false);
  const showNav = () => setIsNavVisible(true);

  const value = {
    isNavVisible,
    hideNav,
    showNav
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export default NavigationContext; 