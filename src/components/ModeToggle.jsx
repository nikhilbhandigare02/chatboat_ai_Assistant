import React from 'react';

export const ModeToggle = ({ mode, onModeChange }) => {
  const modes = [
    { id: 'appointment', label: 'Appointment', icon: '📅' },
    { id: 'appointment-voice', label: 'Voice Booking', icon: '🎤' },
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'voice', label: 'Voice', icon: '🔊' },
    { id: 'call', label: 'Call', icon: '📞' }
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-sm">
      <div className="flex flex-wrap gap-1">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            className={`flex-1 min-w-fit px-3 py-2 rounded-lg font-medium transition-all text-sm ${
              mode === m.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="mr-1">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
};
