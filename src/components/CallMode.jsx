import React, { useState, useEffect, useRef } from 'react';

export const CallMode = ({ selectedPatient, allPatients }) => {
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, connected, ended
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [twilioNumber, setTwilioNumber] = useState('');
  const [userPhoneNumber, setUserPhoneNumber] = useState('+917620593008'); // Your number
  const [phoneInput, setPhoneInput] = useState('+917620593008'); // Temporary input
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [usePatientNumber, setUsePatientNumber] = useState(true); // Toggle between patient number and custom number
  const [bulkCallMode, setBulkCallMode] = useState(false); // Toggle between single and bulk call
  const [bulkCallStatus, setBulkCallStatus] = useState({}); // Track individual call statuses
  const [isListening, setIsListening] = useState(false); // Speech recognition state
  const [recognition, setRecognition] = useState(null); // Speech recognition instance
  const [currentTranscript, setCurrentTranscript] = useState(''); // Current speech transcript
  const timerRef = useRef(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  useEffect(() => {
    // Fetch Twilio number from backend
    fetch(`${backendUrl}/call/number`)
      .then(res => res.json())
      .then(data => {
        if (data.number) {
          setTwilioNumber(data.number);
        }
      })
      .catch(err => {
        console.error('Error fetching Twilio number:', err);
        setTwilioNumber('+1-XXX-XXX-XXXX');
      });

    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onstart = () => {
        setIsListening(true);
        console.log('Speech recognition started');
      };

      recognitionInstance.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setCurrentTranscript(prev => prev + finalTranscript);
          addTranscriptEntry('user', finalTranscript.trim());
        }
      };

      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'no-speech') {
          addTranscriptEntry('system', 'No speech detected. Please try again.');
        } else {
          addTranscriptEntry('system', `Speech recognition error: ${event.error}`);
        }
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
        console.log('Speech recognition ended');
      };

      setRecognition(recognitionInstance);
    } else {
      console.log('Speech recognition not supported');
      addTranscriptEntry('system', 'Speech recognition is not supported in this browser. Please use Chrome or Edge.');
    }
  }, []);

  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [callStatus]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCall = async () => {
    if (!selectedPatient && !bulkCallMode) {
      alert('Please select a patient from the dropdown first');
      return;
    }

    if (bulkCallMode) {
      await handleBulkCall();
      return;
    }

    // Use patient's phone number if available and usePatientNumber is true, otherwise use custom number
    const phoneNumber = usePatientNumber && selectedPatient.phone ? selectedPatient.phone : userPhoneNumber;

    if (!phoneNumber || phoneNumber.length < 10) {
      alert('Please enter a valid phone number to initiate call');
      return;
    }

    setCallStatus('calling');
    setDuration(0);
    setTranscript([]);

    try {
      const response = await fetch(`${backendUrl}/call/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: phoneNumber,
          patient: {
            name: selectedPatient.name,
            policyId: selectedPatient.policyId,
            plan: selectedPatient.plan
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        // Simulate call connection (in production, this would be handled by Twilio webhooks)
        setTimeout(() => {
          setCallStatus('connected');
          addTranscriptEntry('system', `Call connected to ${phoneNumber}`);
          addTranscriptEntry('ai', 'Congratulations! 🎉 You have successfully purchased a policy from Tata AIA Life Insurance. A medical check-up is required. Please choose your preferred option: select Home Visit or Diagnostic Center Visit.');
          
          // Auto-start speech recognition for single calls
          if (!bulkCallMode) {
            setTimeout(() => {
              startSpeechRecognition();
            }, 1000);
          }
        }, 2000);
      } else {
        setCallStatus('idle');
        alert('Failed to initiate call: ' + data.error);
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      setCallStatus('idle');
      alert('Failed to initiate call. Make sure the backend server is running.');
    }
  };

  const handleBulkCall = async () => {
    if (!allPatients || allPatients.length === 0) {
      alert('No patients available for bulk calling');
      return;
    }

    setCallStatus('calling');
    setDuration(0);
    setTranscript([]);
    
    // Initialize bulk call status for all patients
    const initialStatus = {};
    allPatients.forEach(patient => {
      initialStatus[patient.id] = { status: 'calling', startTime: Date.now() };
    });
    setBulkCallStatus(initialStatus);

    addTranscriptEntry('system', `Initiating bulk calls to ${allPatients.length} patients...`);

    // Initiate calls to all patients simultaneously
    const callPromises = allPatients.map(async (patient) => {
      const phoneNumber = usePatientNumber && patient.phone ? patient.phone : userPhoneNumber;
      
      if (!phoneNumber || phoneNumber.length < 10) {
        setBulkCallStatus(prev => ({
          ...prev,
          [patient.id]: { status: 'failed', error: 'Invalid phone number' }
        }));
        return { patient, success: false, error: 'Invalid phone number' };
      }

      try {
        const response = await fetch(`${backendUrl}/call/initiate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: phoneNumber,
            patient: {
              name: patient.name,
              policyId: patient.policyId,
              plan: patient.plan
            }
          })
        });

        const data = await response.json();
        
        if (data.success) {
          // Simulate call connection after delay
          setTimeout(() => {
            setBulkCallStatus(prev => ({
              ...prev,
              [patient.id]: { status: 'connected', connectedTime: Date.now() }
            }));
            addTranscriptEntry('system', `Call connected to ${patient.name} (${phoneNumber})`);
            addTranscriptEntry('ai', `Hello ${patient.name}! 🎉 You have successfully purchased a policy from Tata AIA Life Insurance. A medical check-up is required. Please choose your preferred option: select Home Visit or Diagnostic Center Visit.`);
            
            // Start speech recognition for the first connected call in bulk mode
            if (!isListening) {
              setTimeout(() => {
                startSpeechRecognition();
              }, 500);
            }
          }, 2000);
          
          return { patient, success: true, callSid: data.callSid };
        } else {
          setBulkCallStatus(prev => ({
            ...prev,
            [patient.id]: { status: 'failed', error: data.error }
          }));
          return { patient, success: false, error: data.error };
        }
      } catch (error) {
        console.error(`Error initiating call to ${patient.name}:`, error);
        setBulkCallStatus(prev => ({
          ...prev,
          [patient.id]: { status: 'failed', error: error.message }
        }));
        return { patient, success: false, error: error.message };
      }
    });

    // Wait for all calls to be initiated
    const results = await Promise.all(callPromises);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    addTranscriptEntry('system', `Bulk call initiation complete: ${successful.length} successful, ${failed.length} failed`);
    
    // Set overall status to connected if any calls succeeded
    if (successful.length > 0) {
      setTimeout(() => {
        setCallStatus('connected');
      }, 3000);
    } else {
      setCallStatus('idle');
    }
  };

  const handlePhoneNumberChange = (e) => {
    setPhoneInput(e.target.value);
  };

  const handleSavePhoneNumber = () => {
    if (phoneInput && phoneInput.length >= 10) {
      setUserPhoneNumber(phoneInput);
      setShowPhoneInput(false);
    } else {
      alert('Please enter a valid phone number');
    }
  };

  const startSpeechRecognition = () => {
    if (recognition && !isListening) {
      recognition.start();
      addTranscriptEntry('system', '🎤 Speech recognition started - Listening to call...');
    }
  };

  const stopSpeechRecognition = () => {
    if (recognition && isListening) {
      recognition.stop();
      addTranscriptEntry('system', '🔇 Speech recognition stopped');
    }
  };

  const toggleSpeechRecognition = () => {
    if (isListening) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };

  const handleEndCall = () => {
    stopSpeechRecognition(); // Stop speech recognition when call ends
    setCallStatus('ended');
    addTranscriptEntry('system', 'Call ended');
    setCurrentTranscript(''); // Clear current transcript

    setTimeout(() => {
      setCallStatus('idle');
      setDuration(0);
    }, 3000);
  };

  const addTranscriptEntry = (speaker, text) => {
    setTranscript(prev => [
      ...prev,
      {
        speaker,
        text,
        timestamp: new Date().toISOString()
      }
    ]);
  };

  // Simulate receiving speech from call (in production, this comes from Twilio)
  const simulateIncomingSpeech = () => {
    if (callStatus === 'connected') {
      addTranscriptEntry('user', 'I want to check my claim status');
      setTimeout(() => {
        addTranscriptEntry('ai', 'Sure, I can help you check your claim status. Let me pull up your information.');
      }, 1500);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Phone Call Mode</h2>
        <p className="text-gray-600">Connect with MedInsure AI via phone call</p>
      </div>

      {/* Call Interface */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
        {/* Call Mode Toggle */}
        <div className="mb-6 text-center">
          <div className="text-sm text-gray-600 mb-2">Call Mode:</div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setBulkCallMode(false)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                !bulkCallMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📞 Single Call
            </button>
            <button
              onClick={() => setBulkCallMode(true)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                bulkCallMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📞 Bulk Call
            </button>
          </div>
        </div>

        {/* Patient Info Display */}
        {!bulkCallMode && selectedPatient && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <div className="text-sm text-gray-600">Calling as:</div>
            <div className="text-lg font-bold text-gray-800">{selectedPatient.name}</div>
            <div className="text-sm text-gray-600">
              {selectedPatient.policyId} • {selectedPatient.plan}
            </div>

            {/* Phone Number Section */}
            <div className="mt-4 pt-4 border-t border-blue-200">
              <div className="text-xs text-gray-500 mb-2">Call Options:</div>
              
              {/* Toggle between patient number and custom number */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setUsePatientNumber(true)}
                  className={`flex-1 px-2 py-1 text-xs rounded ${
                    usePatientNumber 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Use Patient Number
                </button>
                <button
                  onClick={() => setUsePatientNumber(false)}
                  className={`flex-1 px-2 py-1 text-xs rounded ${
                    !usePatientNumber 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Use Custom Number
                </button>
              </div>

              {usePatientNumber && selectedPatient.phone ? (
                <div>
                  <div className="text-xs text-gray-500">Patient's Mobile Number:</div>
                  <button
                    onClick={handleCall}
                    disabled={callStatus !== 'idle'}
                    className="mt-1 w-full text-left px-3 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <div className="text-lg font-mono font-bold text-green-700">
                      📱 {selectedPatient.phone}
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      {callStatus === 'idle' ? 'Click to call this number' : 'Call in progress...'}
                    </div>
                  </button>
                </div>
              ) : (
                <div>
                  {!showPhoneInput ? (
                    <div>
                      <div className="text-xs text-gray-500">Custom Phone Number:</div>
                      <div className="text-lg font-mono font-bold text-blue-600 mt-1">{userPhoneNumber}</div>
                      <button
                        onClick={() => {
                          setPhoneInput(userPhoneNumber);
                          setShowPhoneInput(true);
                        }}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Change Number
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="tel"
                        value={phoneInput}
                        onChange={handlePhoneNumberChange}
                        placeholder="Enter phone number (with country code)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSavePhoneNumber}
                          className="flex-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setShowPhoneInput(false);
                            setPhoneInput(userPhoneNumber);
                          }}
                          className="flex-1 px-2 py-1 bg-gray-400 hover:bg-gray-500 text-white text-sm rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bulk Call Patient Display */}
        {bulkCallMode && (
          <div className="mb-6 w-full max-w-4xl">
            <div className="text-center mb-4">
              <div className="text-lg font-bold text-gray-800">
                📞 Bulk Call Mode
              </div>
              <div className="text-sm text-gray-600">
                Calling all {allPatients?.length || 0} patients simultaneously
              </div>
            </div>
            
            {/* Number Source Toggle */}
            <div className="mb-4 text-center">
              <div className="text-xs text-gray-500 mb-2">Number Source:</div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setUsePatientNumber(true)}
                  className={`px-3 py-1 text-xs rounded ${
                    usePatientNumber 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Use Patient Numbers
                </button>
                <button
                  onClick={() => setUsePatientNumber(false)}
                  className={`px-3 py-1 text-xs rounded ${
                    !usePatientNumber 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Use Custom Number
                </button>
              </div>
            </div>

            {/* Patient Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allPatients?.map((patient) => (
                <div
                  key={patient.id}
                  className={`p-4 border rounded-lg ${
                    bulkCallStatus[patient.id]?.status === 'connected'
                      ? 'bg-green-50 border-green-200'
                      : bulkCallStatus[patient.id]?.status === 'calling'
                      ? 'bg-blue-50 border-blue-200'
                      : bulkCallStatus[patient.id]?.status === 'failed'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="text-sm font-bold text-gray-800 mb-1">
                    {patient.name}
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    {patient.policyId} • {patient.plan}
                  </div>
                  <div className="text-xs text-gray-500 mb-1">Phone:</div>
                  <div className="text-sm font-mono font-bold text-blue-600 mb-2">
                    📱 {usePatientNumber && patient.phone ? patient.phone : userPhoneNumber}
                  </div>
                  <div className="text-xs text-gray-500">
                    Status: 
                    <span className={`ml-1 font-semibold ${
                      bulkCallStatus[patient.id]?.status === 'connected'
                        ? 'text-green-600'
                        : bulkCallStatus[patient.id]?.status === 'calling'
                        ? 'text-blue-600'
                        : bulkCallStatus[patient.id]?.status === 'failed'
                        ? 'text-red-600'
                        : 'text-gray-600'
                    }`}>
                      {bulkCallStatus[patient.id]?.status || 'Ready'}
                    </span>
                  </div>
                  {bulkCallStatus[patient.id]?.error && (
                    <div className="text-xs text-red-600 mt-1">
                      Error: {bulkCallStatus[patient.id].error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!bulkCallMode && !selectedPatient && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
            <div className="text-sm text-yellow-800">
              ⚠️ Please select a patient from the dropdown above
            </div>
          </div>
        )}

        {/* Twilio Number Display */}
        <div className="mb-8 text-center">
          <div className="text-sm text-gray-600 mb-2">Call our AI assistant at:</div>
          <div className="text-3xl font-bold text-blue-600">{twilioNumber}</div>
          <div className="text-sm text-gray-500 mt-2">
            Or use the button below to receive a call
          </div>
        </div>

        {/* Call Status Indicator */}
        <div className="mb-8">
          <div
            className={`w-32 h-32 rounded-full flex items-center justify-center ${
              callStatus === 'connected'
                ? 'bg-green-500 animate-pulse'
                : callStatus === 'calling'
                ? 'bg-blue-500 animate-pulse'
                : callStatus === 'ended'
                ? 'bg-red-500'
                : 'bg-gray-300'
            }`}
          >
            <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          </div>
        </div>

        {/* Call Status Text */}
        <div className="text-center mb-4">
          <div className="text-xl font-semibold text-gray-800">
            {callStatus === 'idle' && 'Ready to Call'}
            {callStatus === 'calling' && 'Calling...'}
            {callStatus === 'connected' && 'Connected'}
            {callStatus === 'ended' && 'Call Ended'}
          </div>
          {callStatus === 'connected' && (
            <div className="text-2xl font-mono text-blue-600 mt-2">
              {formatDuration(duration)}
            </div>
          )}
          
          {/* Speech Recognition Status */}
          {callStatus === 'connected' && (
            <div className="mt-3">
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={toggleSpeechRecognition}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    isListening 
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {isListening ? '🔇 Stop Listening' : '🎤 Start Listening'}
                </button>
                <div className="text-sm text-gray-600">
                  {isListening ? '🎧 Capturing conversation...' : '🔇 Speech recognition off'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Current Transcript Display */}
        {callStatus === 'connected' && currentTranscript && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg max-w-2xl">
            <div className="text-xs text-gray-600 mb-1">🎤 Live Transcription:</div>
            <div className="text-sm text-gray-800 italic">
              "{currentTranscript.trim()}"
            </div>
          </div>
        )}

        {/* Call Controls */}
        <div className="flex space-x-4">
          {callStatus === 'idle' && (
            <button
              onClick={handleCall}
              disabled={(!selectedPatient && !bulkCallMode) || (bulkCallMode && !allPatients?.length)}
              className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-full font-semibold shadow-lg transition-all transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
            >
              <span className="mr-2">📞</span>
              {bulkCallMode 
                ? (allPatients?.length ? `Start Bulk Call (${allPatients.length} patients)` : 'No Patients Available')
                : (selectedPatient ? 'Start Call' : 'Select Patient First')
              }
            </button>
          )}

          {(callStatus === 'calling' || callStatus === 'connected') && (
            <button
              onClick={handleEndCall}
              className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-full font-semibold shadow-lg transition-all transform hover:scale-105"
            >
              <span className="mr-2">📞</span>
              {bulkCallMode ? 'End All Calls' : 'End Call'}
            </button>
          )}

          {/* Test button for simulating speech */}
          {callStatus === 'connected' && !bulkCallMode && (
            <button
              onClick={simulateIncomingSpeech}
              className="px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-semibold shadow-lg transition-all"
            >
              Test Speech
            </button>
          )}
        </div>
      </div>

      {/* Transcript Panel */}
      {transcript.length > 0 && (
        <div className="bg-white border-t border-gray-200 p-6 max-h-80 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Call Transcript</h3>
            {isListening && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                <span>🎧 Recording...</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {transcript.map((entry, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  entry.speaker === 'user'
                    ? 'bg-blue-50 border border-blue-200'
                    : entry.speaker === 'ai'
                    ? 'bg-green-50 border border-green-200'
                    : entry.speaker === 'system'
                    ? 'bg-yellow-50 border border-yellow-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="flex items-start">
                  <div className="font-semibold text-sm mr-2">
                    {entry.speaker === 'user' ? '👤 You:' : 
                     entry.speaker === 'ai' ? '🤖 AI:' : 
                     entry.speaker === 'system' ? 'ℹ️ System:' : '📞'}
                  </div>
                  <div className="flex-1 text-sm text-gray-800">{entry.text}</div>
                  <div className="text-xs text-gray-500 ml-2">
                    {new Date(entry.timestamp).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Clear Transcript Button */}
          {transcript.length > 0 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setTranscript([]);
                  setCurrentTranscript('');
                }}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg"
              >
                Clear Transcript
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
