import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, History, Settings, ChevronDown } from 'lucide-react';

const UserMenu = ({ user, onLogout, onViewHistory }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    {
      icon: History,
      label: 'Processing History',
      onClick: () => {
        onViewHistory();
        setIsOpen(false);
      }
    },
    {
      icon: Settings,
      label: 'Settings',
      onClick: () => {
        // TODO: Implement settings
        setIsOpen(false);
      }
    },
    {
      icon: LogOut,
      label: 'Sign Out',
      onClick: () => {
        onLogout();
        setIsOpen(false);
      },
      className: 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
    }
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-white text-sm font-medium">
          {user?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-zinc-100 truncate">
            {user?.display_name || user?.email?.split('@')[0] || 'User'}
          </p>
          <p className="text-xs text-zinc-500 truncate">
            {user?.email}
          </p>
        </div>
        <ChevronDown 
          size={16} 
          className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg py-2 z-10">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={item.onClick}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-zinc-700 transition-colors ${
                  item.className || 'text-zinc-300 hover:text-zinc-100'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserMenu;