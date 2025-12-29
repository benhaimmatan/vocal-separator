import React, { useState } from 'react';
import { FiDownload, FiSettings, FiVolume2, FiMic } from 'react-icons/fi';
import './SystemAudioGuide.css';

const SystemAudioGuide: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Install BlackHole Audio Driver",
      icon: <FiDownload size={24} />,
      content: (
        <div className="step-content">
          <p>BlackHole is a free virtual audio driver that routes system audio:</p>
          <ol>
            <li>Download BlackHole from: <a href="https://github.com/ExistentialAudio/BlackHole" target="_blank" rel="noopener noreferrer">https://github.com/ExistentialAudio/BlackHole</a></li>
            <li>Install the 2ch version (stereo)</li>
            <li>Restart your computer after installation</li>
          </ol>
          <div className="warning">
            ⚠️ <strong>Note:</strong> Installing audio drivers requires admin permissions
          </div>
        </div>
      )
    },
    {
      title: "Configure Audio MIDI Setup",
      icon: <FiSettings size={24} />,
      content: (
        <div className="step-content">
          <p>Create a Multi-Output Device to route audio to both speakers and BlackHole:</p>
          <ol>
            <li>Open <strong>Audio MIDI Setup</strong> (Applications → Utilities)</li>
            <li>Click the <strong>+</strong> button and select <strong>"Create Multi-Output Device"</strong></li>
            <li>Check both your <strong>speakers/headphones</strong> and <strong>BlackHole 2ch</strong></li>
            <li>Set your speakers as the <strong>Master Device</strong></li>
            <li>Name it "Speakers + BlackHole"</li>
          </ol>
        </div>
      )
    },
    {
      title: "Set System Output",
      icon: <FiVolume2 size={24} />,
      content: (
        <div className="step-content">
          <p>Route all system audio through the Multi-Output Device:</p>
          <ol>
            <li>Go to <strong>System Preferences → Sound → Output</strong></li>
            <li>Select <strong>"Speakers + BlackHole"</strong> as your output device</li>
            <li>You should still hear audio normally through your speakers</li>
          </ol>
          <div className="tip">
            💡 <strong>Tip:</strong> You can switch back to regular speakers anytime in Sound preferences
          </div>
        </div>
      )
    },
    {
      title: "Use BlackHole as Microphone Input",
      icon: <FiMic size={24} />,
      content: (
        <div className="step-content">
          <p>Now you can capture system audio in our app:</p>
          <ol>
            <li>In the Live Capture tab, click <strong>"Start Microphone Capture"</strong></li>
            <li>When prompted, select <strong>"BlackHole 2ch"</strong> as your microphone</li>
            <li>Play music from Spotify, YouTube, or any app</li>
            <li>The audio will be captured and analyzed for chords!</li>
          </ol>
          <div className="success">
            ✅ <strong>Success!</strong> You can now analyze chords from any audio playing on your Mac
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="system-audio-guide">
      <div className="guide-header">
        <h2>🔧 System Audio Capture Setup for macOS</h2>
        <p>Follow these steps to capture audio from Spotify, YouTube, and other apps</p>
      </div>

      <div className="steps-navigation">
        {steps.map((step, index) => (
          <button
            key={index}
            className={`step-nav ${currentStep === index ? 'active' : ''} ${currentStep > index ? 'completed' : ''}`}
            onClick={() => setCurrentStep(index)}
          >
            <div className="step-icon">{step.icon}</div>
            <div className="step-title">{step.title}</div>
          </button>
        ))}
      </div>

      <div className="step-content-container">
        <div className="step-header">
          <div className="step-number">Step {currentStep + 1} of {steps.length}</div>
          <h3>{steps[currentStep].title}</h3>
        </div>
        
        {steps[currentStep].content}

        <div className="step-navigation">
          <button 
            className="nav-button prev"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            ← Previous
          </button>
          
          <button 
            className="nav-button next"
            onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
            disabled={currentStep === steps.length - 1}
          >
            Next →
          </button>
        </div>
      </div>

      <div className="alternative-solutions">
        <h3>🔄 Alternative Solutions</h3>
        <div className="alternatives-grid">
          <div className="alternative">
            <h4>🎸 Direct Instrument Connection</h4>
            <p>Connect guitars, keyboards, or other instruments directly to your computer's audio input for real-time chord analysis.</p>
          </div>
          
          <div className="alternative">
            <h4>🎧 Audio Interface</h4>
            <p>Use an audio interface to route any audio source (including line-out from other devices) into your computer.</p>
          </div>
          
          <div className="alternative">
            <h4>📱 Upload Audio Files</h4>
            <p>Record audio separately and upload files using the regular chord detection feature for the most accurate results.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemAudioGuide;