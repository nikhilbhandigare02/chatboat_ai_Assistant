import React, { useState, useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

export function AppointmentBookingVoice({ selectedPatient, onSpeakResponse }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [currentOptions, setCurrentOptions] = useState([]);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const speakFunctionRef = useRef(null);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.language = 'en-IN';
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    }
  }, []);

  // Receive speak function from parent
  useEffect(() => {
    if (onSpeakResponse) {
      onSpeakResponse(async (text) => {
        speakFunctionRef.current = text;
      });
    }
  }, [onSpeakResponse]);

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
          channelType: 'voice'
        })
      });

      const data = await response.json();

      if (data.success) {
        setSessionId(data.sessionId);
        const initialMessage = {
          role: 'assistant',
          content: data.message,
          type: data.type,
          timestamp: new Date().toISOString()
        };
        setMessages([initialMessage]);
        setCurrentOptions(data.options);

        // Speak the initial message
        speakMessage(data.message);
      } else {
        const errorMsg = {
          role: 'assistant',
          content: 'Failed to initialize booking session. Please try again.',
          type: 'error',
          timestamp: new Date().toISOString()
        };
        setMessages([errorMsg]);
      }
    } catch (error) {
      console.error('Error initializing booking:', error);
      const errorMsg = {
        role: 'assistant',
        content: 'Error connecting to booking service. Please try again.',
        type: 'error',
        timestamp: new Date().toISOString()
      };
      setMessages([errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const speakMessage = async (text) => {
    try {
      const response = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play().catch(err => console.error('Audio playback error:', err));
    } catch (error) {
      console.error('Error speaking message:', error);
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        if (transcript.trim()) {
          handleSpeechInput(transcript.trim());
        }
      };
      recognitionRef.current.start();
    }
  };

  const handleSpeechInput = async (speechText) => {
    if (!sessionId) return;

    // Convert speech to number if it's a word (e.g., "one" -> "1")
    const speechToNumber = {
      'one': '1', '1': '1',
      'two': '2', '2': '2',
      'three': '3', '3': '3',
      'home': '1', 'home visit': '1',
      'center': '2', 'diagnostic': '2', 'diagnostic center': '2',
      'yes': 'yes', 'no': 'no'
    };

    const userInput = speechToNumber[speechText.toLowerCase()] || speechText;

    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: `🎤 ${speechText}`,
      type: 'selection',
      timestamp: new Date().toISOString()
    }]);
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
        const assistantMsg = {
          role: 'assistant',
          content: data.message,
          type: data.type,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMsg]);

        if (data.type === 'confirmation') {
          setCurrentOptions([]);
          if (data.bookingDetails) {
            const details = data.bookingDetails;
            const flowType = details.flow === 'home' ? 'Home Visit' : 'Diagnostic Center Visit';
            const confirmationMsg = `✅ Appointment Confirmed!\nType: ${flowType}\nTime: ${details.time}\nPatient: ${details.user}`;
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

        // Speak the response
        speakMessage(data.message);
      } else {
        const errorMsg = {
          role: 'assistant',
          content: data.error || 'An error occurred. Please try again.',
          type: 'error',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (error) {
      console.error('Error handling voice input:', error);
      const errorMsg = {
        role: 'assistant',
        content: 'Error processing your input. Please try again.',
        type: 'error',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
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
          <p className="text-lg">Please select a patient to start booking an appointment via voice</p>
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

      {/* Voice Input Controls */}
      <div className="border-t bg-white p-6">
        {messages.some(m => m.type === 'confirmation') ? (
          <div className="flex gap-3">
            <button
              onClick={handleNewBooking}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              📅 Book Another Appointment
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Exit
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {currentOptions.length > 0 && (
              <div className="text-sm text-gray-600 mb-3">
                <p className="font-medium mb-2">You can say or click an option:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentOptions.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleSpeechInput(option.split(' ')[0])}
                      disabled={isLoading || isListening}
                      className="px-3 py-2 text-left bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={startListening}
              disabled={isLoading || isListening || messages.some(m => m.type === 'confirmation')}
              className={`w-full px-6 py-4 rounded-lg font-medium text-white transition-all flex items-center justify-center gap-2 ${
                isListening
                  ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isListening ? (
                <>
                  <span className="text-xl">🎤</span>
                  Listening...
                </>
              ) : (
                <>
                  <span className="text-xl">🎤</span>
                  Click to Speak or Select Option
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
