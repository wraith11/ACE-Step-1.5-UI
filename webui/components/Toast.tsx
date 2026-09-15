import React from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  isVisible: boolean;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, isVisible, onClose }) => {
  if (!isVisible) return null;
  const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-zinc-800';
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 rounded-xl shadow-2xl text-white text-sm font-medium animate-in fade-in slide-in-from-bottom-2 flex items-center gap-3"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <span className={`w-2 h-2 rounded-full ${bg}`}></span>
      <span className="text-zinc-100">{message}</span>
      <button onClick={onClose} className="text-zinc-400 hover:text-white ml-2 text-lg leading-none">×</button>
    </div>
  );
};