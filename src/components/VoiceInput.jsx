import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3003';

export const VoiceInput = ({ onTranscriptComplete, onSpeakResponse, disabled }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const currentAudioRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition is not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcriptPart + ' ';
        } else {
          interim += transcriptPart;
        }
      }

      if (final) {
        setTranscript(prev => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setError(`Recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Speak text using Azure TTS
  const speak = useCallback(async (text) => {
    if (!text || text.trim() === '') {
      return Promise.resolve();
    }

    // Stop any current audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    setIsSpeaking(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/tts/synthesize`, {
        text: text.trim()
      }, {
        responseType: 'blob'
      });

      // Create audio blob and play
      const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      currentAudioRef.current = audio;

      return new Promise((resolve, reject) => {
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          resolve();
        };

        audio.onerror = (event) => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          setError('Audio playback failed');
          reject(new Error('Audio playback failed'));
        };

        audio.play().catch(err => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          currentAudioRef.current = null;
          setError('Failed to play audio');
          reject(err);
        });
      });

    } catch (err) {
      setIsSpeaking(false);
      const errorMessage = err.response?.data?.error || err.message || 'Speech synthesis failed';
      setError(errorMessage);
      return Promise.reject(new Error(errorMessage));
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        setTranscript('');
        setInterimTranscript('');
        setError(null);
        recognitionRef.current.start();
      } catch (err) {
        console.error('Error starting recognition:', err);
        setError('Failed to start speech recognition');
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const stopSpeaking = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  const fullTranscript = transcript + interimTranscript;

  // Expose speak function to parent
  useEffect(() => {
    if (onSpeakResponse) {
      onSpeakResponse(speak);
    }
  }, [speak, onSpeakResponse]);

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  const handleSendTranscript = () => {
    if (transcript.trim()) {
      onTranscriptComplete(transcript.trim());
      resetTranscript();
    }
  };

  // Auto-send when user stops speaking
  useEffect(() => {
    let timeout;
    if (transcript && !isListening) {
      timeout = setTimeout(() => {
        handleSendTranscript();
      }, 1000);
    }
    return () => clearTimeout(timeout);
  }, [transcript, isListening]);

  return (
    <div className="bg-white border-t border-gray-200 p-4">
      {/* Transcript Display */}
      {(transcript || interimTranscript) && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Transcript:</div>
          <div className="text-gray-900">
            {transcript}
            <span className="text-gray-400 italic">{interimTranscript}</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center space-x-3">
        {/* Microphone Button */}
        <button
          onClick={handleToggleListening}
          disabled={disabled || isSpeaking}
          className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-blue-600 hover:bg-blue-700'
          } disabled:bg-gray-300 disabled:cursor-not-allowed`}
        >
          {isListening ? (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <rect x="6" y="6" width="8" height="8" rx="1" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
              <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
            </svg>
          )}
        </button>

        {/* Status Text */}
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-700">
            {isSpeaking ? (
              <span className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                AI is speaking...
              </span>
            ) : isListening ? (
              <span className="flex items-center">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                Listening...
              </span>
            ) : (
              <span className="text-gray-500">
                {disabled ? 'Select a patient to start' : 'Click microphone to speak'}
              </span>
            )}
          </div>
          {fullTranscript && (
            <div className="text-xs text-gray-500 mt-1">
              {fullTranscript.length} characters captured
            </div>
          )}
        </div>

        {/* Stop Speaking Button */}
        {isSpeaking && (
          <button
            onClick={stopSpeaking}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all font-medium"
          >
            Stop
          </button>
        )}

        {/* Send Transcript Button */}
        {transcript && !isListening && (
          <button
            onClick={handleSendTranscript}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all font-medium"
          >
            Send
          </button>
        )}
      </div>

      {/* Voice Animation */}
      {isListening && (
        <div className="flex justify-center items-center space-x-1 mt-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-blue-500 rounded-full animate-soundWave"
              style={{
                height: '20px',
                animationDelay: `${i * 0.1}s`
              }}
            ></div>
          ))}
        </div>
      )}
    </div>
  );
};
