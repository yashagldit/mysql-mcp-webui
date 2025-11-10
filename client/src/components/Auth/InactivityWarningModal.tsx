import React, { useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Modal, Button } from '../Common';

interface InactivityWarningModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onStayLoggedIn: () => void;
}

export const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  isOpen,
  secondsRemaining,
  onStayLoggedIn,
}) => {
  // Allow user to extend session by pressing any key
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isOpen && e.key !== 'Escape') {
        onStayLoggedIn();
      }
    };

    if (isOpen) {
      document.addEventListener('keypress', handleKeyPress);
    }

    return () => {
      document.removeEventListener('keypress', handleKeyPress);
    };
  }, [isOpen, onStayLoggedIn]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onStayLoggedIn} // Allow closing by clicking outside to extend session
      title="Session Expiring Soon"
      showCloseButton={false}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-center py-4">
          <div className="flex flex-col items-center space-y-2">
            <Clock className="w-12 h-12 text-yellow-500 animate-pulse" />
            <div className="text-center">
              <p className="text-gray-300">
                You will be automatically logged out due to inactivity in:
              </p>
              <p className="text-3xl font-bold text-white mt-2">
                {secondsRemaining} {secondsRemaining === 1 ? 'second' : 'seconds'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <p className="text-sm text-gray-300 text-center">
            Click the button below to stay logged in and continue your session.
          </p>
        </div>

        <Button
          variant="primary"
          className="w-full"
          onClick={onStayLoggedIn}
        >
          Stay Logged In
        </Button>
      </div>
    </Modal>
  );
};
