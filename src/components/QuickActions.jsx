import React from 'react';

export const QuickActions = ({ onActionClick, disabled }) => {
  const actions = [
    { id: 'appointment', label: 'Book Appointment', icon: '📅' },
    { id: 'claims', label: 'Check Claims', icon: '📋' },
    { id: 'payments', label: 'View Payments', icon: '💳' },
    { id: 'faq', label: 'FAQs', icon: '❓' }
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onActionClick(action.id)}
            disabled={disabled}
            className="flex items-center justify-center px-3 py-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="mr-2">{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};
