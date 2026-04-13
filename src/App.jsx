import React, { useState, useRef } from 'react';
import { PatientSelector } from './components/PatientSelector';
import { ModeToggle } from './components/ModeToggle';
import { QuickActions } from './components/QuickActions';
import { ChatWindow } from './components/ChatWindow';
import { ChatInput } from './components/ChatInput';
import { VoiceInput } from './components/VoiceInput';
import { CallMode } from './components/CallMode';
import { AppointmentBookingChat } from './components/AppointmentBookingChat';
import { AppointmentBookingVoice } from './components/AppointmentBookingVoice';
import { AppointmentBookingCall } from './components/AppointmentBookingCall';
import { sendMessage } from './services/groqService';
import patientsData from './data/patients.json';
import './App.css';

function App() {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [mode, setMode] = useState('appointment'); // appointment, chat, voice, call
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const speakFunctionRef = useRef(null);

  const handlePatientChange = (patient) => {
    setSelectedPatient(patient);
    setMessages([]);
    if (patient) {
      addMessage('assistant', `Hello ${patient.name}! I'm your MedInsure AI assistant. How can I help you today?`);
    }
  };

  const addMessage = (role, content) => {
    setMessages(prev => [
      ...prev,
      {
        role,
        content,
        timestamp: new Date().toISOString()
      }
    ]);
  };

  const handleSendMessage = async (userMessage) => {
    if (!selectedPatient) {
      alert('Please select a patient first');
      return;
    }

    // Add user message
    addMessage('user', userMessage);
    setIsTyping(true);

    try {
      // Prepare conversation history for Groq
      const conversationHistory = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      // Get AI response
      const response = await sendMessage(conversationHistory, selectedPatient);

      // Add AI response
      addMessage('assistant', response.message);

      // If in voice mode, speak the response
      if (mode === 'voice' && speakFunctionRef.current) {
        try {
          await speakFunctionRef.current(response.message);
        } catch (error) {
          console.error('Error speaking response:', error);
        }
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      addMessage('assistant', "I'm sorry, I can only help you with booking your medical appointment. I'm here to assist you with scheduling your mandatory medical check-up through MedInsure.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickAction = (actionId) => {
    if (!selectedPatient) {
      alert('Please select a patient first');
      return;
    }

    // If appointment booking is selected, switch to appointment mode
    if (actionId === 'appointment') {
      setMode('appointment');
      return;
    }

    const actionMessages = {
      claims: 'Can you show me my claim status?',
      payments: 'I want to view my payment history',
      faq: 'I have a question about my insurance coverage'
    };

    const message = actionMessages[actionId];
    if (message) {
      handleSendMessage(message);
    }
  };

  const handleSpeakResponse = (speakFunction) => {
    speakFunctionRef.current = speakFunction;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">MedInsure AI</h1>
              <p className="text-blue-100 mt-1">Your Health Insurance Assistant</p>
            </div>
            <div className="flex items-center space-x-4">
  <div className="text-right">
    <div className="text-sm text-blue-100">Powered by</div>
    <div className="font-semibold text-yellow-300">Alphonsol Pvt Ltd</div>
  </div>
</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 flex gap-6 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 flex flex-col space-y-4 overflow-y-auto">
          <PatientSelector
            selectedPatient={selectedPatient}
            onPatientChange={handlePatientChange}
          />
          <ModeToggle mode={mode} onModeChange={setMode} />
          {(mode === 'chat' || mode === 'voice') && (
            <QuickActions
              onActionClick={handleQuickAction}
              disabled={!selectedPatient}
            />
          )}
        </div>

        {/* Main Chat/Voice/Call Area */}
        <div className="flex-1 bg-white rounded-lg shadow-lg flex flex-col overflow-y-auto">
          {mode === 'appointment' ? (
            <AppointmentBookingChat selectedPatient={selectedPatient} />
          ) : mode === 'appointment-voice' ? (
            <AppointmentBookingVoice selectedPatient={selectedPatient} onSpeakResponse={handleSpeakResponse} />
          ) : mode === 'appointment-call' ? (
            <AppointmentBookingCall selectedPatient={selectedPatient} onSpeakResponse={handleSpeakResponse} />
          ) : mode === 'call' ? (
            <CallMode selectedPatient={selectedPatient} allPatients={patientsData.patients} />
          ) : (
            <>
              <ChatWindow messages={messages} isTyping={isTyping} />
              {mode === 'chat' ? (
                <ChatInput
                  onSendMessage={handleSendMessage}
                  disabled={!selectedPatient}
                />
              ) : (
                <VoiceInput
                  onTranscriptComplete={handleSendMessage}
                  onSpeakResponse={handleSpeakResponse}
                  disabled={!selectedPatient}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-600">
          <p>
            MedInsure AI &copy; 2026 | Health Insurance Made Simple |
            <span className="ml-2">
              {mode === 'appointment' ? '📅 Appointment Booking (Chat)' : mode === 'appointment-voice' ? '🎤 Appointment Booking (Voice)' : mode === 'appointment-call' ? '📞 Appointment Booking (Call)' : mode === 'chat' ? '💬 Chat Mode' : mode === 'voice' ? '🔊 Voice Mode' : '📞 Call Mode'}
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
