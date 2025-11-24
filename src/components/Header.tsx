import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getAvatarUrl } from '@/lib/avatarUtils';

interface HeaderProps {
  showAuthModal?: () => void;
}

export default function Header({ showAuthModal }: HeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <>
      <nav className="relative z-10 flex justify-between items-center px-6 py-4 max-w-7xl mx-auto border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="#000000"/>
              </svg>
            </div>
            <div className="text-xl font-bold text-gray-900">InPrepare</div>
          </button>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <button 
            onClick={() => navigate('/')}
            className="text-gray-700 hover:text-gray-900 transition-colors"
          >
            Home
          </button>
          <button 
            onClick={() => navigate('/about')}
            className="text-gray-700 hover:text-gray-900 transition-colors"
          >
            About
          </button>
          <button 
            onClick={() => navigate('/services')}
            className="text-gray-700 hover:text-gray-900 transition-colors"
          >
            Services
          </button>
          <button 
            onClick={() => navigate('/contact')}
            className="text-gray-700 hover:text-gray-900 transition-colors"
          >
            Contact
          </button>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/dashboard')}
                className="text-gray-700 hover:text-gray-900"
              >
                Dashboard
              </Button>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={getAvatarUrl(user.avatar, user.name)} />
                  <AvatarFallback className="bg-blue-600 text-white">
                    {user.name ? user.name.split(' ').map(n => n[0]).join('') : 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-gray-700 hidden md:block">{user.name || 'User'}</span>
              </div>
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-800"
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <>
              <Button 
                onClick={showAuthModal || (() => navigate('/register'))}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2"
              >
                Sign Up
              </Button>
              <button 
                className="md:hidden p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex flex-col gap-4">
            <button 
              onClick={() => {
                navigate('/');
                setMobileMenuOpen(false);
              }}
              className="text-left text-gray-700 hover:text-blue-600"
            >
              Home
            </button>
            <button 
              onClick={() => {
                navigate('/about');
                setMobileMenuOpen(false);
              }}
              className="text-left text-gray-700 hover:text-blue-600"
            >
              About
            </button>
            <button 
              onClick={() => {
                navigate('/services');
                setMobileMenuOpen(false);
              }}
              className="text-left text-gray-700 hover:text-blue-600"
            >
              Services
            </button>
            <button 
              onClick={() => {
                navigate('/contact');
                setMobileMenuOpen(false);
              }}
              className="text-left text-gray-700 hover:text-blue-600"
            >
              Contact
            </button>
            {!user && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  if (showAuthModal) {
                    showAuthModal();
                  } else {
                    navigate('/register');
                  }
                  setMobileMenuOpen(false);
                }}
                className="text-gray-700"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

