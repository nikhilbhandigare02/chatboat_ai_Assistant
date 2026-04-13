import React, { useState, useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

export function AppointmentBookingChat({ selectedPatient }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [currentOptions, setCurrentOptions] = useState([]);
  const messagesEndRef = useRef(null);

  // Initialize booking session
  useEffect(() => {
    if (selectedPatient) {
      initializeBooking();
    }
  }, [selectedPatient]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeBooking = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/booking/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedPatient.id,
          channelType: 'chat'
        })
      });

      const data = await response.json();

      if (data.success) {
        setSessionId(data.sessionId);
        setMessages([
          {
            role: 'assistant',
            content: data.message,
            type: data.type,
            timestamp: new Date().toISOString()
          }
        ]);
        setCurrentOptions(data.options);
      } else {
        setMessages([
          {
            role: 'assistant',
            content: 'Failed to initialize booking session. Please try again.',
            type: 'error',
            timestamp: new Date().toISOString()
          }
        ]);
      }
    } catch (error) {
      console.error('Error initializing booking:', error);
      setMessages([
        {
          role: 'assistant',
          content: 'Error connecting to booking service. Please try again.',
          type: 'error',
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionClick = async (option) => {
    if (!sessionId) return;

    // Extract the key from the option (e.g., "1 - Home Visit" -> "1")
    const userInput = option.split(' ')[0];

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: option, type: 'selection', timestamp: new Date().toISOString() }]);
    setCurrentOptions([]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/booking/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userInput
        })
      });

      const data = await response.json();

      if (data.success) {
        // Add assistant message
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.message,
            type: data.type,
            timestamp: new Date().toISOString()
          }
        ]);

        // Update options for next step
        if (data.type === 'confirmation') {
          setCurrentOptions([]);
          // Show booking details
          if (data.bookingDetails) {
            const details = data.bookingDetails;
            const flowType = details.flow === 'home' ? 'Home Visit' : 'Diagnostic Center Visit';
            const confirmationMsg = `✅ Appointment Confirmed!\nType: ${flowType}\nTime: ${details.time}\nPassenger: ${details.user}`;

            setMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content: confirmationMsg,
                type: 'confirmation',
                timestamp: new Date().toISOString()
              }
            ]);
          }
        } else {
          setCurrentOptions(data.options || []);
        }
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.error || 'An error occurred. Please try again.',
            type: 'error',
            timestamp: new Date().toISOString()
          }
        ]);
      }
    } catch (error) {
      console.error('Error handling option:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Error processing your selection. Please try again.',
          type: 'error',
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewBooking = () => {
    setSessionId(null);
    setMessages([]);
    setCurrentOptions([]);
    initializeBooking();
  };

  if (!selectedPatient) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-lg">Please select a patient to start booking an appointment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Loading appointment booking...</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message.content}
              isUser={message.role === 'user'}
              timestamp={message.timestamp}
            />
          ))
        )}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Options / Buttons */}
      <div className="border-t bg-white p-6">
        {currentOptions.length > 0 ? (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {currentOptions.map((option, index) => (
              <button
                key={index}
                onClick={() => handleOptionClick(option)}
                disabled={isLoading}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                {option}
              </button>
            ))}
          </div>
        ) : messages.some(m => m.type === 'confirmation') ? (
          <div className="flex gap-3">
            <button
              onClick={handleNewBooking}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Book Another Appointment
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Exit
            </button>
          </div>
        ) : (
          <p className="text-gray-500 text-center">Loading options...</p>
        )}
      </div>
    </div>
  );
}
