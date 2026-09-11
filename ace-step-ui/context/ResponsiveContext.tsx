import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface ResponsiveContextType {
  isMobile: boolean;
  isDesktop: boolean;
}

const ResponsiveContext = createContext<ResponsiveContextType>({ isMobile: false, isDesktop: true });

export function ResponsiveProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return (
    <ResponsiveContext.Provider value={{ isMobile, isDesktop: !isMobile }}>
      {children}
    </ResponsiveContext.Provider>
  );
}

export function useResponsive(): ResponsiveContextType {
  return useContext(ResponsiveContext);
}