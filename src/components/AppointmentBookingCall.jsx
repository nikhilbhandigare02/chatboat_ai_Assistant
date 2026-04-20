import React, { useState, useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

export function AppointmentBookingCall({ selectedPatient, onSpeakResponse }) {
  const [bookingSessionId, setBookingSessionId] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // idle, active, completed
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const speakFunctionRef = useRef(null);
  const isProcessingRef = useRef(false);
  const currentAudioRef = useRef(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize booking session
  const initializeBookingSession = async () => {
    try {
      console.log('[CALL DEBUG] Initializing booking session for patient:', selectedPatient?.id);
      const response = await fetch('/api/booking/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedPatient.id,
          channelType: 'call'
        })
      });

      const data = await response.json();
      console.log('[CALL DEBUG] /api/booking/start response:', data);

      if (data.success) {
        setBookingSessionId(data.sessionId);
        console.log('[CALL DEBUG] SessionId set to:', data.sessionId);
        const initialMessage = {
          role: 'assistant',
          content: data.message,
          type: data.type,
          timestamp: new Date().toISOString()
        };
        setMessages([initialMessage]);

        // Speak the initial message
        speakMessage(data.message);
        return true;
      } else {
        const errorMsg = {
          role: 'assistant',
          content: 'Failed to initialize booking session. Please try again.',
          type: 'error',
          timestamp: new Date().toISOString()
        };
        setMessages([errorMsg]);
        return false;
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
      return false;
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
      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause();
        } catch (error) {
          console.error('Audio pause error:', error);
        }
        currentAudioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      audio.play().catch(err => console.error('Audio playback error:', err));
    } catch (error) {
      console.error('Error speaking message:', error);
    }
  };

  const startListening = () => {
    console.log('[CALL DEBUG] startListening called, isListening:', isListening, 'isProcessing:', isProcessing);
    if (recognitionRef.current && !isListening && !isProcessing) {
      recognitionRef.current.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        console.log('[CALL DEBUG] Speech recognized:', transcript);
        if (transcript.trim()) {
          handleSpeechInput(transcript.trim());
        }
      };
      recognitionRef.current.start();
    } else {
      console.log('[CALL DEBUG] Cannot start listening - conditions not met');
    }
  };

  const handleSpeechInput = async (speechText) => {
    console.log('[CALL DEBUG] handleSpeechInput called with:', speechText);
    console.log('[CALL DEBUG] bookingSessionId:', bookingSessionId);

    if (isProcessingRef.current) {
      console.log('[CALL DEBUG] Ignoring speech input - already processing');
      return;
    }

    if (!bookingSessionId) {
      console.log('[CALL DEBUG] No sessionId, returning');
      return;
    }

    // Convert speech to number if it's a word
    const speechToNumber = {
      'one': '1', '1': '1',
      'two': '2', '2': '2',
      'three': '3', '3': '3',
      'home': '1', 'home visit': '1',
      'center': '2', 'diagnostic': '2', 'diagnostic center': '2',
      'yes': 'yes', 'no': 'no'
    };

    const userInput = speechToNumber[speechText.toLowerCase()] || speechText;
    console.log('[CALL DEBUG] Converted to userInput:', userInput);

    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: `🎤 ${speechText}`,
      type: 'selection',
      timestamp: new Date().toISOString()
    }]);

    isProcessingRef.current = true;
    setIsProcessing(true);

    try {
      console.log('[CALL DEBUG] Calling /api/booking/respond with:', { sessionId: bookingSessionId, userInput });
      const response = await fetch('/api/booking/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: bookingSessionId,
          userInput
        })
      });

      const data = await response.json();
      console.log('[CALL DEBUG] Response received:', data);

      if (data.success) {
        console.log('[CALL DEBUG] Success! Adding message, currentStep:', data.currentStep);
        const assistantMsg = {
          role: 'assistant',
          content: data.message,
          type: data.type,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, assistantMsg]);

        if (data.type === 'confirmation') {
          setCallStatus('completed');
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
      console.error('Error handling speech input:', error);
      const errorMsg = {
        role: 'assistant',
        content: 'Error processing your input. Please try again.',
        type: 'error',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleStartCall = async () => {
    setCallStatus('active');
    const sessionInitialized = await initializeBookingSession();
    if (!sessionInitialized) {
      setCallStatus('idle');
    }
  };

  const handleNewCall = () => {
    setBookingSessionId(null);
    setMessages([]);
    setCallStatus('idle');
  };

  if (!selectedPatient) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-lg">Please select a patient to make an appointment booking call</p>
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
            <p>Click "📞 Start Call" to begin appointment booking</p>
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
        {isProcessing && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Controls */}
      <div className="border-t bg-white p-6">
        {callStatus === 'idle' ? (
          <button
            onClick={handleStartCall}
            className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors text-lg"
          >
            📞 Start Call
          </button>
        ) : callStatus === 'completed' ? (
          <div className="flex gap-3">
            <button
              onClick={handleNewCall}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              📞 New Call
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
            <p className="text-sm text-gray-600">🎤 Say your choice (e.g., "home visit", "one", "yes"):</p>
            <button
              onClick={startListening}
              disabled={isProcessing || isListening}
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
                  Click to Speak Your Choice
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
