import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Loader2, Phone } from 'lucide-react';
import { IWindow, VoiceCommandResponse, Property, Professional } from '../types';
import { parseVoiceCommand, ChatMessage } from '../services/geminiService';

interface VoiceAssistantProps {
  properties: Property[];
  professionals: Professional[];
  currentView: string;
  selectedItem: any; // Context for the AI
  onIntent: (response: VoiceCommandResponse) => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  properties,
  professionals,
  currentView,
  selectedItem,
  onIntent
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const recognitionRef = useRef<any>(null);

  // Refs to hold latest values without triggering useEffect re-runs
  const propertiesRef = useRef(properties);
  const professionalsRef = useRef(professionals);
  const onIntentRef = useRef(onIntent);
  const chatHistoryRef = useRef(chatHistory);
  const currentViewRef = useRef(currentView);
  const selectedItemRef = useRef(selectedItem);

  // Keep refs in sync with props/state
  useEffect(() => { propertiesRef.current = properties; }, [properties]);
  useEffect(() => { professionalsRef.current = professionals; }, [professionals]);
  useEffect(() => { onIntentRef.current = onIntent; }, [onIntent]);
  useEffect(() => { chatHistoryRef.current = chatHistory; }, [chatHistory]);
  useEffect(() => { currentViewRef.current = currentView; }, [currentView]);
  useEffect(() => { selectedItemRef.current = selectedItem; }, [selectedItem]);

  // Improved Speak function with Callback
  const speak = (text: string, onEnd?: () => void) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-AR';
      utterance.rate = 1.1;

      if (onEnd) {
        utterance.onend = onEnd;
      }

      window.speechSynthesis.speak(utterance);
    } else {
      if (onEnd) onEnd();
    }
  };

  const startListening = () => {
    try {
      if (recognitionRef.current) {
        setTimeout(() => {
          recognitionRef.current.start();
          setIsListening(true);
        }, 100);
      }
    } catch (e) {
      console.error("Error starting speech recognition:", e);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Initialize SpeechRecognition ONCE on mount
  useEffect(() => {
    const windowObj = window as unknown as IWindow;
    const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'es-AR';
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setAiResponse(null);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = async (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setIsProcessing(true);

        // Read latest values from refs (avoids stale closures)
        const currentHistory = chatHistoryRef.current;

        // 1. Update History
        const updatedHistory: ChatMessage[] = [...currentHistory, { role: 'user', content: text }];
        setChatHistory(updatedHistory);

        // 2. Get Intent from AI with FULL CONTEXT
        const result = await parseVoiceCommand(
          text,
          propertiesRef.current,
          professionalsRef.current,
          updatedHistory,
          currentViewRef.current,
          selectedItemRef.current
        );

        setIsProcessing(false);

        // 3. Update History with AI Response
        if (result.responseText) {
          const historyWithResponse: ChatMessage[] = [...updatedHistory, { role: 'assistant', content: result.responseText }];
          setChatHistory(historyWithResponse);
          setAiResponse(result.responseText);
        }

        console.log("AI ACTION:", result);

        // 4. Handle Conversation Flow
        if (result.requiresFollowUp) {
          speak(result.responseText, () => {
            startListening();
          });
        } else {
          // Speak AND Execute
          speak(result.responseText);

          // Execute Action via Parent
          setTimeout(() => {
            onIntentRef.current(result);

            // Auto-clear history on successful "Terminal" actions
            if (['NAVIGATE', 'SEARCH_MAP', 'SELECT_ITEM', 'REGISTER_EXPENSE', 'UPDATE_PROPERTY', 'STOP_LISTENING'].includes(result.intent)) {
              setChatHistory([]);
            }

            // Explicitly close if intent is STOP_LISTENING
            if (result.intent === 'STOP_LISTENING') {
              setAiResponse(null);
              stopListening();
            }
          }, 800);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech error", event.error);
        setIsListening(false);
        setIsProcessing(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_) { }
      }
    };
  }, []); // Empty dependency array — initialize ONCE

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      setTranscript('');
      setAiResponse(null);
      if (!isProcessing) {
        setChatHistory([]);
      }
      startListening();
    }
  };

  return (
    <>
      {/* Non-blocking Floating UI */}
      {(isListening || isProcessing || aiResponse) && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[2000] flex flex-col items-center justify-end pointer-events-none">

          <div className="bg-black/90 backdrop-blur-md rounded-3xl p-6 shadow-2xl border border-white/10 flex flex-col items-center gap-4 min-w-[320px] max-w-md pointer-events-auto animate-in slide-in-from-bottom-10 fade-in duration-300">

            {/* Header: Status & Close */}
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`} />
                <span className="text-sm font-medium text-white/80">
                  {isProcessing ? 'Procesando...' : isListening ? 'Escuchando...' : 'Sada'}
                </span>
              </div>
              <button
                onClick={() => {
                  stopListening();
                  setAiResponse(null);
                  setChatHistory([]);
                  window.speechSynthesis.cancel();
                }}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-white/50" />
              </button>
            </div>

            {/* Content Area */}
            <div className="w-full text-center">
              {/* User Transcript */}
              {transcript && !aiResponse && (
                <p className="text-lg text-white font-light leading-snug">
                  "{transcript}"
                </p>
              )}

              {/* AI Response */}
              {aiResponse && (
                <p className="text-xl text-blue-200 font-medium leading-relaxed drop-shadow-sm">
                  {aiResponse}
                </p>
              )}

              {/* Thinking Indicator */}
              {isProcessing && !transcript && (
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto opacity-50" />
              )}
            </div>

            {/* Visual Waveform (Fake) */}
            {isListening && (
              <div className="flex items-center gap-1 h-8">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-1 bg-red-400 rounded-full animate-music-bar" style={{ animationDelay: `${i * 0.1}s`, height: '40%' }}></div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Floating Trigger Button (Bottom Right) - Only show if Assistant is HIDDEN */}
      {!(isListening || isProcessing || aiResponse) && (
        <button
          onClick={toggleListening}
          className={`fixed bottom-8 right-8 z-[1900] 
            flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300 group
            bg-black hover:scale-105 border border-white/20
          `}
        >
          <Mic className="w-6 h-6 text-white" />
        </button>
      )}
    </>
  );
};

export default VoiceAssistant;