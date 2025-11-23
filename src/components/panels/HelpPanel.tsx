import React from 'react';
import { HelpCircle, Book, MessageCircle, Bug, ExternalLink, Github, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import PanelBackground from '../PanelBackground';

const HelpPanel: React.FC = () => {
  const shortcuts = [
    { keys: ['`'], description: 'Toggle recording' },
    { keys: ['Cmd', '`'], description: 'Screenshot + voice' },
    { keys: ['Esc'], description: 'Cancel recording' },
  ];

  const faqs = [
    {
      q: 'How do I use agent mode?',
      a: 'Say "Hey [Agent Name]" before your command, and the AI will process your request intelligently.'
    },
    {
      q: 'Why is my transcription slow?',
      a: 'Larger Whisper models provide better accuracy but are slower. Try using "base" or "tiny" for faster results.'
    },
    {
      q: 'Can I use Tribe Whisper offline?',
      a: 'Yes! Enable local Whisper mode in AI Models settings to process everything on your device.'
    },
    {
      q: 'How do I change the hotkey?',
      a: 'Go to Dictation settings and click "Change" next to the recording hotkey.'
    },
  ];

  return (
    <PanelBackground>
      <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Help & Support</h2>
        <p className="text-zinc-400">Get help with Whisper</p>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Book className="w-5 h-5 text-blue-400" />
          Keyboard Shortcuts
        </h3>

        <div className="space-y-3">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">{shortcut.description}</span>
              <div className="flex gap-1">
                {shortcut.keys.map((key, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-zinc-500">+</span>}
                    <kbd className="px-2 py-1 bg-zinc-800 rounded text-xs font-mono text-white">
                      {key}
                    </kbd>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-purple-400" />
          Frequently Asked Questions
        </h3>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="space-y-2">
              <p className="text-sm font-medium text-white">{faq.q}</p>
              <p className="text-sm text-zinc-400">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Tips */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-green-400" />
          Quick Tips
        </h3>

        <ul className="space-y-2 text-sm text-zinc-400">
          <li>• Highlight text before recording to enhance it with AI</li>
          <li>• Use Dictionary for automatic text expansions</li>
          <li>• Create Snippets for frequently used text blocks</li>
          <li>• Style profiles help format text for different contexts</li>
          <li>• The backtick (`) key works best for agent mode</li>
          <li>• Say your agent's name naturally in conversation</li>
        </ul>
      </div>

      {/* Support Links */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Bug className="w-5 h-5 text-red-400" />
          Get Support
        </h3>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start border-zinc-700 text-zinc-300 hover:text-white"
            onClick={() => window.open('https://github.com/openwhispr/openwhispr/issues', '_blank')}
          >
            <Github className="w-4 h-4 mr-2" />
            Report an Issue
            <ExternalLink className="w-3 h-3 ml-auto" />
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start border-zinc-700 text-zinc-300 hover:text-white"
            onClick={() => window.open('https://github.com/openwhispr/openwhispr', '_blank')}
          >
            <Github className="w-4 h-4 mr-2" />
            View on GitHub
            <ExternalLink className="w-3 h-3 ml-auto" />
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start border-zinc-700 text-zinc-300 hover:text-white"
            onClick={() => window.open('mailto:support@openwhispr.app', '_blank')}
          >
            <Mail className="w-4 h-4 mr-2" />
            Email Support
            <ExternalLink className="w-3 h-3 ml-auto" />
          </Button>
        </div>
      </div>

      {/* About */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">About Tribe Whisper</h3>

        <div className="space-y-3 text-sm text-zinc-400">
          <p>Version 1.0.0</p>
          <p>
            Tribe Whisper is a privacy-focused dictation app that uses OpenAI's Whisper
            for accurate speech-to-text transcription.
          </p>
          <p className="text-xs">
            Built with Electron, React, and TypeScript<br />
            © 2024 Whisper. MIT License.
          </p>
        </div>
      </div>
      </div>
    </PanelBackground>
  );
};

export default HelpPanel;