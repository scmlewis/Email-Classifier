import React, { useState, useCallback, useEffect } from 'react';
import { geminiService, RECIPIENTS } from './services/geminiService';
import { EmailClassification, ClassifiedEmailHistoryItem } from './types';

function App() {
  const [emailContent, setEmailContent] = useState<string>('');
  const [classification, setClassification] = useState<EmailClassification | null>(null);
  const [loading, setLoading] = useState<boolean>(false); // For Classify Email button
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ClassifiedEmailHistoryItem[]>([]);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [copyingHistoryItemId, setCopyingHistoryItemId] = useState<string | null>(null);
  const [copiedMainEmail, setCopiedMainEmail] = useState<boolean>(false);

  // States for suggested recipient autocomplete
  const [editableRecipient, setEditableRecipient] = useState<string>('');
  const [showRecipientSuggestions, setShowRecipientSuggestions] = useState<boolean>(false);
  const [filteredRecipients, setFilteredRecipients] = useState<string[]>([]);

  // States for AI-driven actions
  const [responseDraft, setResponseDraft] = useState<string | null>(null);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [generatingResponse, setGeneratingResponse] = useState<boolean>(false);
  const [extractingActions, setExtractingActions] = useState<boolean>(false);

  // New states for parsed email content
  const [parsedFrom, setParsedFrom] = useState<string>('');
  const [parsedSubject, setParsedSubject] = useState<string>('');
  const [parsedBody, setParsedBody] = useState<string>('');
  const [parsingFormLoading, setParsingFormLoading] = useState<boolean>(false); // For Parse and Fill Form button
  const [quickPasteLoading, setQuickPasteLoading] = useState<boolean>(false); // For Quick Paste button

  // State for collapsible history
  const [showHistory, setShowHistory] = useState<boolean>(true);


  // Example Emails for test cases
  const exampleEmails = [
    {
      label: 'Support Request',
      content: `From: customer@example.com
Subject: Urgent Support Request - Order #54321

Dear Support Team,

I am writing to report a critical issue with my recent order, #54321. The item I received is not working as expected, and I need immediate assistance. I have tried troubleshooting steps, but nothing has resolved the problem.

Please provide instructions on how to proceed with a replacement or repair. My phone number is +1 (555) 123-4567.

Thank you,
A Frustrated Customer`
    },
    {
      label: 'Sales Inquiry',
      content: `From: potentialclient@business.com
Subject: Inquiry about your Enterprise Software Solutions

To Whom It May Concern,

Our company is interested in learning more about your enterprise software solutions, specifically your CRM and project management tools. We are looking for a scalable solution for a team of 50+ users.

Could you please provide a brochure or schedule a demo with a sales representative? We are available next Tuesday or Thursday afternoon.

Best regards,
Sarah Johnson
Head of Operations`
    },
    {
      label: 'Finance / Billing',
      content: `From: accounts@supplier.com
Subject: Invoice #2024-00123 Due Date Reminder

Dear Valued Client,

This is a friendly reminder that Invoice #2024-00123 for $1,500.00 is due on October 26, 2024. Please ensure timely payment to avoid any service interruptions.

You can view your invoice details and make a payment through our portal: [link to portal]

Thank you for your business.

Sincerely,
Accounts Department`
    },
    {
      label: 'Urgent Incident',
      content: `From: systemalert@company.com
Subject: CRITICAL: Database Server Offline - Incident #9876

HIGH PRIORITY INCIDENT

The main production database server (DB-PROD-01) went offline at 14:35 UTC. This is impacting all customer-facing services. The incident response team has been notified.

Please check the incident dashboard for real-time updates: [link to dashboard]

System Administrator`
    },
    {
      label: 'Spam / Marketing',
      content: `From: offer@bestdeals.net
Subject: EXCLUSIVE OFFER: Get 50% Off Your Next Purchase!

Hi there,

Don't miss out on our limited-time offer! Get 50% off all products in our store. Click the link below to unlock your discount:

[Spammy Link]

This offer expires soon!

Best regards,
The Best Deals Team`
    },
  ];

  // Utility function to parse email content
  const parseEmailContent = useCallback((rawEmail: string) => {
    let from = '';
    let subject = '';
    let body = '';

    const lines = rawEmail.split('\n');
    let bodyStartIndex = 0;

    // Find From:
    const fromMatch = rawEmail.match(/^From: (.+)$/m);
    if (fromMatch) {
      from = fromMatch[1].trim();
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('From:')) {
          bodyStartIndex = i + 1;
          break;
        }
      }
    }

    // Find Subject:
    const subjectMatch = rawEmail.match(/^Subject: (.+)$/m);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('Subject:')) {
          bodyStartIndex = Math.max(bodyStartIndex, i + 1);
          break;
        }
      }
    }

    // Extract body: everything after the last header identified
    body = lines.slice(bodyStartIndex).join('\n').trim();

    return { from, subject, body };
  }, []);

  // Load history from localStorage on component mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('emailClassificationHistory');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }
    } catch (e) {
      console.error("Failed to load history from localStorage", e);
      // Optionally clear corrupted history or notify user
      localStorage.removeItem('emailClassificationHistory');
      setHistory([]);
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('emailClassificationHistory', JSON.stringify(history));
  }, [history]);

  // Update editableRecipient and clear AI action states when classification changes
  useEffect(() => {
    if (classification) {
      setEditableRecipient(classification.suggestedRecipient);
      setResponseDraft(null);
      setActionItems([]);
    } else {
      setEditableRecipient('');
      setResponseDraft(null);
      setActionItems([]);
    }
  }, [classification]);

  // Also parse email content whenever the main emailContent state changes
  useEffect(() => {
    const { from, subject, body } = parseEmailContent(emailContent);
    setParsedFrom(from);
    setParsedSubject(subject);
    setParsedBody(body);
  }, [emailContent, parseEmailContent]);


  const handleClassifyEmail = useCallback(async () => {
    if (!emailContent.trim()) {
      setError('Please enter email content to classify.');
      setClassification(null);
      return;
    }

    setLoading(true); // For Classify Email button
    setError(null);
    setClassification(null);
    setResponseDraft(null); // Clear previous draft
    setActionItems([]); // Clear previous action items

    try {
      const result = await geminiService.classifyEmail(emailContent);
      setClassification(result);

      // Save to history
      const newHistoryItem: ClassifiedEmailHistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString(),
        emailContent: emailContent,
        classification: result,
      };
      setHistory((prevHistory) => [newHistoryItem, ...prevHistory]);

    } catch (err: unknown) {
      console.error(err);
      setError(`Failed to classify email: ${err instanceof Error ? err.message : 'An unknown error occurred.'}`);
    } finally {
      setLoading(false); // For Classify Email button
    }
  }, [emailContent, history]); // Added history to dependency array to ensure latest history is used for update

  const handleClearHistory = useCallback(() => {
    if (window.confirm("Are you sure you want to clear all history?")) {
      setHistory([]);
      localStorage.removeItem('emailClassificationHistory');
    }
  }, []);

  const handleLoadHistoryItem = useCallback((item: ClassifiedEmailHistoryItem) => {
    setEmailContent(item.emailContent);
    // Parsing will happen automatically via useEffect when emailContent changes
    setClassification(item.classification);
    setResponseDraft(null); // Clear previous draft when loading from history
    setActionItems([]); // Clear previous action items when loading from history
    // Scroll to the top to show the loaded content and classification
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSendEmail = useCallback((recipient: string) => {
    window.open(`mailto:${recipient}`, '_blank');
  }, []);

  const handleCopyEmailContent = useCallback(async (id: string, content: string) => {
    setCopyingHistoryItemId(id); // Set loading state for this item
    try {
      await navigator.clipboard.writeText(content);
      setCopiedItemId(id);
      setTimeout(() => setCopiedItemId(null), 2000); // Show "Copied!" for 2 seconds
    } catch (err) {
      console.error("Failed to copy email content:", err);
      alert('Failed to copy. Please check clipboard permissions or try again manually.');
    } finally {
      setCopyingHistoryItemId(null); // Reset loading state
    }
  }, []);

  const handleCopyMainEmailContent = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(emailContent);
      setCopiedMainEmail(true);
      setTimeout(() => setCopiedMainEmail(false), 2000); // Show "Copied!" for 2 seconds
    } catch (err) {
      console.error("Failed to copy main email content:", err);
      alert('Failed to copy. Please check clipboard permissions or try again manually.');
    }
  }, [emailContent]);

  // Autocomplete functions
  const handleRecipientChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEditableRecipient(value);
    if (value) {
      setFilteredRecipients(
        RECIPIENTS.filter((rec) => rec.toLowerCase().includes(value.toLowerCase()))
      );
      setShowRecipientSuggestions(true);
    } else {
      setFilteredRecipients(RECIPIENTS);
      setShowRecipientSuggestions(true);
    }
  }, []);

  const handleSelectRecipient = useCallback((recipient: string) => {
    setEditableRecipient(recipient);
    setShowRecipientSuggestions(false);
  }, []);

  const handleRecipientInputFocus = useCallback(() => {
    setFilteredRecipients(RECIPIENTS); // Show all suggestions on focus
    setShowRecipientSuggestions(true);
  }, []);

  const handleRecipientInputBlur = useCallback(() => {
    // Delay hiding to allow click on a suggestion
    setTimeout(() => setShowRecipientSuggestions(false), 100);
  }, []);

  // New AI-driven action functions
  const handleAcknowledgeAndEscalate = useCallback(() => {
    console.log('Acknowledging and escalating action for:', classification?.category);
    // In a real app, this would trigger an API call or another workflow.
    alert('Action Acknowledged & Escalate!');
  }, [classification]);

  const handleGenerateResponseDraft = useCallback(async () => {
    if (!emailContent.trim() || !classification) {
      setError('Please classify an email first to generate a response draft.');
      return;
    }
    setGeneratingResponse(true);
    setError(null);
    setResponseDraft(null); // Clear previous draft before generating new one
    try {
      const draft = await geminiService.generateResponseDraft(emailContent, classification);
      setResponseDraft(draft);
    } catch (err: unknown) {
      console.error("Error generating response draft:", err);
      setError(`Failed to generate response draft: ${err instanceof Error ? err.message : 'An unknown error occurred.'}`);
    } finally {
      setGeneratingResponse(false);
    }
  }, [emailContent, classification]);

  const handleExtractActionItems = useCallback(async () => {
    if (!emailContent.trim()) {
      setError('Please enter email content to extract action items.');
      return;
    }
    setExtractingActions(true);
    setError(null);
    setActionItems([]); // Clear previous action items before extracting new ones
    try {
      const items = await geminiService.extractActionItems(emailContent);
      setActionItems(items);
    } catch (err: unknown) {
      console.error("Error extracting action items:", err);
      setError(`Failed to extract action items: ${err instanceof Error ? err.message : 'An unknown error occurred.'}`);
    } finally {
      setExtractingActions(false);
    }
  }, [emailContent]);

  const handleLoadExample = useCallback((content: string) => {
    setEmailContent(content);
    // Parsing happens via useEffect
    setClassification(null); // Clear previous classification
    setResponseDraft(null);
    setActionItems([]);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleQuickPaste = useCallback(async () => {
    setQuickPasteLoading(true);
    setError(null);
    setClassification(null);
    setResponseDraft(null);
    setActionItems([]);
    try {
      const text = await navigator.clipboard.readText();
      setEmailContent(text);
      // Parsing happens via useEffect
    } catch (err) {
      console.error("Failed to read from clipboard:", err);
      setError("Failed to paste from clipboard. Please ensure clipboard permissions are granted or paste manually.");
    } finally {
      setQuickPasteLoading(false);
    }
  }, []);

  const handleParseAndFillForm = useCallback(async () => {
    if (!emailContent.trim()) {
      setError('Please enter email content to parse.');
      return;
    }
    setParsingFormLoading(true);
    setError(null);
    // Parsing happens via useEffect when emailContent updates
    // Clear classification, etc., as we're performing a new parse
    setClassification(null);
    setResponseDraft(null);
    setActionItems([]);
    // Update parsedFrom, parsedSubject, parsedBody through useEffect
    // This button only parses and fills, doesn't classify automatically
    setTimeout(() => { // Simulate a small delay for visual feedback if parsing is too fast
      setParsingFormLoading(false);
      // No explicit state update needed here for parsed fields, as useEffect handles it.
    }, 300);
  }, [emailContent]);


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-gray-900 to-blue-950 font-sans">
      <div className="w-full max-w-7xl bg-gray-800 rounded-lg shadow-xl p-8 transform transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl">
        <h1 className="text-4xl font-extrabold text-center text-white mb-8 tracking-tight">
          📧 AI Email Classifier & Router
        </h1>

        {error && (
          <div className="mb-6 p-4 bg-red-900 border border-red-700 text-red-200 rounded-lg text-center shadow-md" role="alert">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Main Content Area - Two Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 mb-8">
          {/* Left Column: Input and Parsing */}
          <div className="bg-gray-700 p-6 rounded-lg border border-gray-600 shadow-sm">
            {/* Load Example section */}
            <div className="mb-6 border-b border-gray-600 pb-4">
              <p className="block text-gray-200 text-lg font-semibold mb-3">Load an example:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {exampleEmails.map((example) => (
                  <button
                    key={example.label}
                    onClick={() => handleLoadExample(example.content)}
                    className="bg-blue-700 hover:bg-blue-600 text-blue-100 font-medium py-2 px-4 rounded-lg text-sm transition-colors duration-200 active:scale-95 whitespace-nowrap"
                    aria-label={`Load example email: ${example.label}`}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Paste Full Email Content button */}
            <button
              onClick={handleQuickPaste}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-all duration-300 ease-in-out transform active:scale-95 flex items-center justify-center mb-6"
              disabled={quickPasteLoading}
              aria-live="polite"
            >
              {quickPasteLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Pasting...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Quick Paste Full Email Content
                </>
              )}
            </button>

            <div className="mb-6">
              <label htmlFor="emailContent" className="block text-gray-200 text-lg font-semibold mb-2">
                Paste the entire raw email (including lines like 'From:', 'Subject:', etc.) below:
              </label>
              <textarea
                id="emailContent"
                className="w-full p-4 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-y min-h-[150px] bg-gray-800 text-gray-100"
                value={emailContent}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEmailContent(e.target.value)}
                placeholder="e.g., 'Subject: Urgent - Issue with my latest order #12345. I need immediate assistance!'"
                rows={8}
                aria-label="Email content input"
              ></textarea>
            </div>

            {/* Parse and Fill Form Button */}
            <button
              onClick={handleParseAndFillForm}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 px-6 rounded-lg text-lg focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-300 ease-in-out transform active:scale-95 flex items-center justify-center mb-6"
              disabled={parsingFormLoading || !emailContent.trim()}
              aria-live="polite"
            >
              {parsingFormLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Parsing...
                </>
              ) : (
                'Parse and Fill Form'
              )}
            </button>


            {/* Parsed Email Fields */}
            {(parsedFrom || parsedSubject || parsedBody) && (
              <div className="mt-4 mb-6 p-4 bg-gray-800 border border-gray-600 rounded-lg shadow-sm">
                <h3 className="text-xl font-bold text-white mb-3">Parsed Email Details:</h3>
                {parsedFrom && (
                  <p className="mb-2 text-gray-200">
                    <strong className="text-white">From:</strong>{' '}
                    <span className="bg-gray-700 px-2 py-1 rounded-md text-sm">{parsedFrom}</span>
                  </p>
                )}
                {parsedSubject && (
                  <p className="mb-2 text-gray-200">
                    <strong className="text-white">Subject:</strong>{' '}
                    <span className="bg-gray-700 px-2 py-1 rounded-md text-sm">{parsedSubject}</span>
                  </p>
                )}
                {parsedBody && (
                  <div className="mb-2 text-gray-200">
                    <strong className="text-white block mb-1">Body:</strong>{' '}
                    <div className="bg-gray-700 px-2 py-1 rounded-md text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">{parsedBody}</div>
                  </div>
                )}
              </div>
            )}

            {/* Original Classify Email button (moved below parsed fields) */}
            <button
              onClick={handleClassifyEmail}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 px-6 rounded-lg text-lg focus:outline-none focus:ring-4 focus:ring-emerald-300 transition-all duration-300 ease-in-out transform active:scale-95 flex items-center justify-center mt-6"
              disabled={loading || !emailContent.trim()}
              aria-live="polite"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Classifying...
                </>
              ) : (
                'Classify Email'
              )}
            </button>
          </div>

          {/* Right Column: Classification Results & Actions */}
          {classification && (
            <div className="bg-green-900 p-6 rounded-lg border border-green-700 shadow-sm md:mt-0">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
                <span className="mr-2 text-green-400">✅</span> Classification Results
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-200">
                <p className="mb-2">
                  <strong className="text-white">Category:</strong>{' '}
                  <span className="bg-blue-700 text-blue-100 text-sm font-semibold mr-2 px-2.5 py-0.5 rounded-full" aria-label={`Category: ${classification.category}`}>{classification.category}</span>
                </p>
                <p className="mb-2">
                  <strong className="text-white">Priority:</strong>{' '}
                  <span className={`text-sm font-semibold mr-2 px-2.5 py-0.5 rounded-full ${
                    classification.priority === 'High' ? 'bg-red-700 text-red-100' :
                    classification.priority === 'Medium' ? 'bg-yellow-700 text-yellow-100' :
                    'bg-gray-600 text-gray-200'
                  }`} aria-label={`Priority: ${classification.priority}`}>{classification.priority}</span>
                </p>
                <div className="mb-2 col-span-1 md:col-span-2 relative z-10"> {/* Added relative positioning and z-index */}
                  <strong className="text-white block mb-1">Suggested Recipient:</strong>
                  <div className="flex items-center">
                    <input
                      type="text"
                      id="suggestedRecipientInput"
                      className="flex-grow p-2 border border-purple-700 rounded-l-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-white bg-purple-900"
                      value={editableRecipient}
                      onChange={handleRecipientChange}
                      onFocus={handleRecipientInputFocus}
                      onBlur={handleRecipientInputBlur}
                      placeholder="Enter recipient email"
                      aria-label="Suggested recipient email address"
                      aria-autocomplete="list"
                      aria-haspopup="listbox"
                      aria-expanded={showRecipientSuggestions}
                      role="combobox"
                    />
                    <button
                      onClick={() => handleSendEmail(editableRecipient)}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-2 px-3 rounded-r-lg transition-all duration-200 ease-in-out active:scale-95 flex items-center whitespace-nowrap"
                      aria-label={`Send email to ${editableRecipient}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-2 4v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      </svg>
                      Send Email
                    </button>
                  </div>
                  {showRecipientSuggestions && filteredRecipients.length > 0 && (
                    <ul
                      className="absolute left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto"
                      role="listbox"
                      aria-labelledby="suggestedRecipientInput"
                    >
                      {filteredRecipients.map((rec) => (
                        <li
                          key={rec}
                          onClick={() => handleSelectRecipient(rec)}
                          className="p-2 cursor-pointer hover:bg-gray-700 text-gray-100 text-sm flex items-center"
                          role="option"
                          aria-selected={rec === editableRecipient}
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-2 4v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            </svg>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Immediate Action Required block (New) */}
              {classification.priority === 'High' && (
                <div className="mt-6 p-4 bg-red-900 border border-red-700 text-red-100 rounded-lg shadow-sm text-center">
                  <p className="font-bold text-lg flex items-center justify-center mb-2">
                    <span className="mr-2 text-red-500 animate-pulse">⚠️</span>Immediate Action Required
                  </p>
                  <p className="text-sm mb-4">
                    This is a critical issue that requires immediate human intervention. The suggested action is: Forward to {editableRecipient}.
                  </p>
                  <button
                    onClick={handleAcknowledgeAndEscalate}
                    className="bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-5 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-red-300 transition-all duration-300 ease-in-out active:scale-95"
                    aria-label="Acknowledge and escalate this immediate action item"
                  >
                    Acknowledge & Escalate
                  </button>
                </div>
              )}

              {/* Generate Response Draft button (New) */}
              <button
                onClick={handleGenerateResponseDraft}
                className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-3 px-6 rounded-lg text-lg focus:outline-none focus:ring-4 focus:ring-purple-300 transition-all duration-300 ease-in-out transform active:scale-95 mt-6 flex items-center justify-center"
                disabled={generatingResponse}
                aria-live="polite"
              >
                {generatingResponse ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Draft...
                  </>
                ) : (
                  <>
                    <span className="mr-2">✨</span> Generate Response Draft
                  </>
                )}
              </button>
              {responseDraft && (
                <div className="mt-4 p-4 bg-purple-900 border border-purple-700 rounded-lg shadow-sm text-gray-100">
                  <strong className="block text-purple-200 mb-2">Generated Draft:</strong>
                  <pre className="whitespace-pre-wrap font-mono text-sm p-2 bg-gray-800 rounded-md border border-gray-700">{responseDraft}</pre>
                </div>
              )}

              <div className="mt-4 border-t border-gray-600 pt-4">
                <div className="flex justify-between items-center mb-2"> {/* Flex container for summary heading and copy button */}
                  <strong className="text-white block">Summary:</strong>
                  <button
                    onClick={handleCopyMainEmailContent}
                    className="ml-2 bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs font-medium py-1 px-3 rounded-full transition-all duration-200 ease-in-out active:scale-95 relative overflow-hidden"
                    aria-label="Copy original email content to clipboard"
                  >
                    {copiedMainEmail ? (
                      <span className="flex items-center justify-center text-green-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Copied!
                      </span>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v4a1 1 0 01-1 1H3m6V7a1 1 0 011-1h4a1 1 0 011 1v3m0 0l3.653 3.653C18.667 14.86 18.258 16 17.067 16H6.933c-1.191 0-1.6-1.14-1.043-2.347L8 10z" />
                        </svg>
                        Copy Email Content
                      </>
                    )}
                  </button>
                </div>
                <p className="italic text-gray-300 bg-gray-800 p-3 rounded-md border border-gray-700">{classification.summary}</p>
              </div>

              {/* Extract Action Items button (New) */}
              <button
                onClick={handleExtractActionItems}
                className="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-bold py-3 px-6 rounded-lg text-lg focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-all duration-300 ease-in-out transform active:scale-95 mt-6 flex items-center justify-center"
                disabled={extractingActions}
                aria-live="polite"
              >
                {extractingActions ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Extracting...
                  </>
                ) : (
                  <>
                    <span className="mr-2">⚡</span> Extract Action Items
                  </>
                )}
              </button>
              {actionItems.length > 0 && (
                <div className="mt-4 p-4 bg-indigo-900 border border-indigo-700 rounded-lg shadow-sm">
                  <strong className="block text-indigo-200 mb-2">Extracted Action Items:</strong>
                  <ul className="list-disc pl-5 text-gray-100">
                    {actionItems.map((item, index) => (
                      <li key={index} className="mb-1 text-sm">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible History Section */}
        {history.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-600">
            <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory}>
              <h2 className="text-2xl font-bold text-white flex items-center">
                <span className="mr-2 text-indigo-400">🕰️</span> Classification History
              </h2>
              <div className="flex items-center">
                <button
                  onClick={(e) => { e.stopPropagation(); handleClearHistory(); }} // Prevent collapse when clearing history
                  className="bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-4 rounded-lg transition-all duration-200 ease-in-out active:scale-95 mr-4"
                  aria-label="Clear all classification history"
                >
                  Clear History
                </button>
                <svg
                  className={`h-6 w-6 text-gray-400 transform transition-transform duration-300 ${showHistory ? 'rotate-180' : 'rotate-0'}`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <div
              className={`transition-all duration-500 ease-in-out overflow-hidden ${showHistory ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4"> {/* Added pt-4 to prevent content jump on collapse */}
                {history.map((item) => (
                  <div key={item.id} className="bg-gray-800 border border-gray-600 rounded-lg p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
                    <div>
                      <p className="text-xs text-gray-400 mb-2">{item.timestamp}</p>
                      <p className="mb-1">
                        <strong className="text-white">Category:</strong>{' '}
                        <span className="bg-blue-700 text-blue-100 text-xs font-semibold px-2 py-0.5 rounded-full">{item.classification.category}</span>
                      </p>
                      <p className="mb-2">
                        <strong className="text-white">Priority:</strong>{' '}
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          item.classification.priority === 'High' ? 'bg-red-700 text-red-100' :
                          item.classification.priority === 'Medium' ? 'bg-yellow-700 text-yellow-100' :
                          'bg-gray-600 text-gray-200'
                        }`}>{item.classification.priority}</span>
                      </p>
                      <p className="text-gray-300 text-sm italic line-clamp-3 mb-3">{item.classification.summary}</p>
                    </div>
                    <div className="flex space-x-2 mt-3"> {/* New flex container for buttons */}
                      <button
                        onClick={() => handleLoadHistoryItem(item)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-all duration-200 ease-in-out active:scale-95"
                        aria-label={`Load email classified on ${item.timestamp}`}
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleCopyEmailContent(item.id, item.emailContent)}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-100 text-sm font-medium py-2 px-4 rounded-md transition-all duration-200 ease-in-out active:scale-95 relative overflow-hidden"
                        aria-label={`Copy email content for item classified on ${item.timestamp}`}
                        disabled={copyingHistoryItemId === item.id}
                      >
                        {copiedItemId === item.id ? (
                          <span className="flex items-center justify-center text-green-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Copied!
                          </span>
                        ) : (
                          copyingHistoryItemId === item.id ? (
                            <span className="flex items-center justify-center text-gray-100">
                              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-gray-100" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Copying...
                            </span>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v4a1 1 0 01-1 1H3m6V7a1 1 0 011-1h4a1 1 0 011 1v3m0 0l3.653 3.653C18.667 14.86 18.258 16 17.067 16H6.933c-1.191 0-1.6-1.14-1.043-2.347L8 10z" />
                              </svg>
                              Copy Email
                            </>
                          )
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;