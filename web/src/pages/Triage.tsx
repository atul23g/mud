import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { triage, Task, sessionSubmit } from '../lib/api'
import { getAccessToken } from '../lib/auth'

export default function Triage() {
  const location = useLocation()
  const [latest, setLatest] = useState<any>(null)
  const [input, setInput] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState<string>('')
  const [messages, setMessages] = useState<{role:'ai'|'user'; content:string; timestamp?:Date}[]>([])

  // Load current data immediately when component mounts
  useEffect(() => {
    // Check if we have report data passed from navigation state first
    const navigationData = location.state?.reportData
    if (navigationData) {
      console.log('Using report data from navigation:', navigationData.prediction?.health_score)
      setLatest(navigationData)
      // Also update localStorage to keep it in sync
      localStorage.setItem('latest_result', JSON.stringify(navigationData))
    } else {
      // Fallback to localStorage if no navigation data
      const currentReport = localStorage.getItem('latest_result')
      if (currentReport) {
        try {
          const parsedReport = JSON.parse(currentReport)
          setLatest(parsedReport)
          console.log('Loaded current report data on mount:', parsedReport.prediction?.health_score)
        } catch (error) {
          console.error('Error loading current report:', error)
        }
      }
    }
  }, [location.state])

  // Monitor for new report submissions
  useEffect(() => {
    const checkForNewReport = () => {
      const currentReport = localStorage.getItem('latest_result')
      const currentTimestamp = currentReport ? new Date().getTime() : null
      
      if (currentReport) {
        try {
          const parsedReport = JSON.parse(currentReport)
          const reportTime = parsedReport.timestamp || parsedReport.created_at || currentTimestamp
          
          // If we have a new report (different from what we have or first load)
          if (!latest || JSON.stringify(parsedReport) !== JSON.stringify(latest)) {
            console.log('New report detected - resetting triage page chatbot conversation')
            setLatest(parsedReport)
            setReportTimestamp(reportTime)
            // Clear chat history for new report
            localStorage.removeItem('dr_intelligence_chat_history_triage')
            // Clear messages immediately for visual feedback
            setMessages([])
            
            // Generate new personalized greeting
            if (parsedReport.prediction) {
              const { health_score, label } = parsedReport.prediction
              const riskLevel = label === 1 ? 'higher risk' : 'lower risk'
              const greeting = `Hello! I'm Dr. Intelligence, your AI Health Assistant. I've reviewed your new results and see you have a health score of ${health_score?.toFixed(1)}/100 with ${riskLevel} indicators. I'm here to provide professional medical guidance. Please feel free to ask any questions about your health status, test results, or next steps.`
              
              // Create initial context message
              const parts: string[] = []
              if (parsedReport.lifestyle) {
                const l = parsedReport.lifestyle
                parts.push(`Lifestyle: smoking=${l.smoking}, alcohol=${l.alcohol}, exercise=${l.exercise}, diet=${l.diet}, stress=${l.stress_level}, sleep_hours=${l.sleep_hours}`)
              }
              if (parsedReport.symptoms) {
                const symTrue = Object.entries(parsedReport.symptoms).filter(([,v]: any)=>v).map(([k]: any)=>String(k).replace(/_/g,' '))
                parts.push(`Symptoms: ${symTrue.length ? symTrue.join(', ') : 'none reported'}`)
              }
              const opener = parts.length ? parts.join(' | ') : 'Please give general guidance based on the prediction.'
          
              setMessages([{ role: 'ai', content: greeting }])
              // Auto-generate initial analysis
              setTimeout(() => ask(opener), 500)
            }
          }
        } catch (error) {
          console.error('Error checking for new report:', error)
        }
      } else {
        // No report available
        setLatest(null)
        setReportTimestamp(null)
        setMessages([])
      }
    }

    // Check immediately and then set up interval
    checkForNewReport()
    const interval = setInterval(checkForNewReport, 2000) // Check every 2 seconds
    
    return () => clearInterval(interval)
  }, [latest]) // Only depend on latest to avoid infinite loops
  const [reportTimestamp, setReportTimestamp] = useState(() => {
    // Store timestamp of when report was loaded to detect changes
    const report = localStorage.getItem('latest_result')
    return report ? new Date().getTime() : null
  })

  // Professional formatting function for medical responses
  const formatMedicalResponse = (content: string) => {
    if (!content || content.trim().length === 0) {
      return "I'm analyzing your medical information to provide personalized guidance."
    }

    // Clean up the content while preserving professional structure
    let formatted = content
      // Remove all emojis for professional appearance
      .replace(/[📊🔍💡❓⚠️✅❌⭐🎯👨‍⚕️👩‍⚕️🩺💊🏥]/g, '')
      .replace(/##/g, '') // Remove markdown headers
      .replace(/Doctor:\s*|Dr\.\s*\w+:\s*|AI\s+Assistant:\s*/gi, '') // Remove doctor/AI prefixes
      .replace(/Clinical\s+Analysis|Based\s+on\s+the\s+analysis|According\s+to\s+the\s+data/gi, 'Based on your medical analysis')
      // Remove asterisks from section headers
      .replace(/\*Analysis\*/gi, 'Analysis')
      .replace(/\*Recommendations\*/gi, 'Recommendations')
      .replace(/\*Next Steps\*/gi, 'Next Steps')
      .replace(/\*Important\*/gi, 'Important')
      .replace(/\*Summary\*/gi, 'Summary')
      .replace(/\*Conclusion\*/gi, 'Conclusion')
      .trim()

    // Enhanced formatting for professional medical responses
    formatted = formatted
      .replace(/^\s*[\-\*•]\s*/gm, '• ') // Standardize bullet points
      .replace(/^\s*\d+\.\s*/gm, '$&') // Keep numbered lists
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff; background: rgba(255,255,255,0.15); padding: 3px 8px; border-radius: 6px; font-size: 0.95em; font-weight: 600; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 1px 2px rgba(0,0,0,0.1);">$1</strong>') // Enhanced bold styling
      .replace(/\*(.*?)\*/g, '<em style="color: #cbd5e1; font-style: italic; opacity: 0.9;">$1</em>') // Enhanced italic styling
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up excessive line breaks
      .replace(/\s{2,}/g, ' ') // Remove excessive spaces
      .trim()

    // Make the response more conversational and natural, like a real doctor
    // formatted = formatted
    //   .replace(/^Analysis\n/i, 'Based on your medical information, I can see that:\n')
    //   .replace(/^Recommendations\n/i, 'Here are my personalized recommendations for you:\n')
    //   .replace(/^Next Steps\n/i, 'Here are the next steps I recommend:\n')
    //   .replace(/^Important\n/i, 'It\'s important to note that:\n')
    //   .replace(/^Summary\n/i, 'To summarize your situation:\n')
    //   .replace(/^Conclusion\n/i, 'In conclusion:\n')

    // Structure the response with professional section headers
    let result = formatted

    // Enhance section headers with professional styling
    result = result
      // .replace(/^Based on your medical information, I can see that:$/m, '<div style="font-weight: 600; font-size: 17px; color: #ffffff; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.3); letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); font-family: \'Inter\', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;">Based on your medical information, I can see that:</div>')
      // .replace(/^Here are my personalized recommendations for you:$/m, '<div style="font-weight: 600; font-size: 17px; color: #ffffff; margin: 16px 0 12px 0; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.3); letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); font-family: \'Inter\', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;">Here are my personalized recommendations for you:</div>')
      // .replace(/^Here are the next steps I recommend:$/m, '<div style="font-weight: 600; font-size: 17px; color: #ffffff; margin: 16px 0 12px 0; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.3); letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); font-family: \'Inter\', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;">Here are the next steps I recommend:</div>')
      // .replace(/^It\'s important to note that:$/m, '<div style="font-weight: 600; font-size: 17px; color: #ffffff; margin: 16px 0 12px 0; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.3); letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); font-family: \'Inter\', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;">It\'s important to note that:</div>')
      // .replace(/^To summarize your situation:$/m, '<div style="font-weight: 600; font-size: 17px; color: #ffffff; margin: 16px 0 12px 0; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.3); letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); font-family: \'Inter\', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;">To summarize your situation:</div>')
      // .replace(/^In conclusion:$/m, '<div style="font-weight: 600; font-size: 17px; color: #ffffff; margin: 16px 0 12px 0; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.3); letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.3); font-family: \'Inter\', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;">In conclusion:</div>')

    // Add proper spacing and formatting for better readability
    result = result
      .replace(/^(?!<div|<p|<br|<•|\s*$)(.+)$/gm, '<p style="margin: 0 0 12px 0; line-height: 1.8; font-size: 15px;">$1</p>')
      .replace(/^•\s+(.+)$/gm, '<div style="margin: 10px 0 10px 20px; position: relative; line-height: 1.7;"><span style="position: absolute; left: -20px; color: #93c5fd; font-size: 18px; line-height: 1;">•</span><span style="margin-left: 12px; display: block; font-size: 15px;">$1</span></div>')
      .replace(/^\d+\.\s+(.+)$/gm, '<div style="margin: 10px 0 10px 24px; position: relative; line-height: 1.7;"><span style="position: absolute; left: -24px; color: #93c5fd; font-weight: 500; font-size: 15px;">$&</span></div>')

    // Add professional medical disclaimer if not present
    if (!result.toLowerCase().includes('consult') && !result.toLowerCase().includes('professional')) {
      result += '<div style="margin-top: 16px; font-size: 0.85em; color: #94a3b8; font-style: italic; padding: 8px 12px; background: rgba(0,0,0,0.2); border-radius: 6px; border-left: 3px solid #64748b;">Note: This information is for educational purposes. Please consult with a healthcare professional for personalized medical advice.</div>'
    }

    return result
  }

  const ask = async (q: string) => {
    if (!latest) return
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    
    const userMessage = { role: 'user' as const, content: q, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    
    try {
      const token = await getAccessToken()
      const r = await triage(
        latest.task as Task,
        latest.features,
        latest.prediction,
        q,
        token,
      )
      setModel(r.model_name)
      const formattedResponse = formatMedicalResponse(r.triage_summary)
      
      const assistantMessage = { role: 'ai' as const, content: formattedResponse, timestamp: new Date() }
      setMessages(prev => [...prev, assistantMessage])
      
      // Sync to shared chat history for bottom-right chatbot - use separate key for triage page
      const sharedMessages = [...messages, userMessage, assistantMessage]
      localStorage.setItem('dr_intelligence_chat_history_triage', JSON.stringify(sharedMessages.slice(-10)))
      
      // Persist triage note for history
      try {
        await sessionSubmit({
          report_id: undefined,
          task: latest.task,
          features: latest.features,
          prediction: latest.prediction,
          triage: { triage_summary: r.triage_summary, followups: r.followups || [], model_name: r.model_name },
          complaint: q,
          prediction_id: latest.prediction_id,
        }, token)
      } catch (err) { /* non-blocking */ }
    } catch (e:any) {
      const errorMessage = formatMedicalResponse(e?.response?.data?.detail || e.message || 'Sorry, I could not respond right now.')
      const errorMsg = { role: 'ai' as const, content: errorMessage, timestamp: new Date() }
      setMessages(prev => [...prev, errorMsg])
      
      // Sync error to shared history too - use separate key for triage page
      const sharedMessages = [...messages, { role: 'user' as const, content: q, timestamp: new Date() }, errorMsg]
      localStorage.setItem('dr_intelligence_chat_history_triage', JSON.stringify(sharedMessages.slice(-10)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Only run this if we have latest data but no messages (initial load)
    if (!latest || messages.length > 0) return
    
    // Check for shared chat history first - use separate key for triage page
    const sharedHistory = localStorage.getItem('dr_intelligence_chat_history_triage')
    if (sharedHistory) {
      try {
        const parsedHistory = JSON.parse(sharedHistory)
        if (parsedHistory.length > 0) {
          // Convert timestamps back to Date objects and set messages
          const historyWithDates = parsedHistory.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
          setMessages(historyWithDates)
          return // Don't show initial greeting if we have history
        }
      } catch (error) {
        console.error('Error loading shared chat history:', error)
      }
    }
    
    // Only show initial greeting if we don't have any messages yet and no new report was detected
    if (messages.length === 0) {
      // Create a personalized greeting based on the patient's data
      let personalizedGreeting = 'Hello! I\'m Dr. Intelligence, your AI Health Assistant.'
      
      if (latest.prediction) {
        const { health_score, label } = latest.prediction
        const riskLevel = label === 1 ? 'higher risk' : 'lower risk'
        personalizedGreeting += ` I've reviewed your results and see you have a health score of ${health_score?.toFixed(1)}/100 with ${riskLevel} indicators.`
      }
      
      personalizedGreeting += ' I\'m here to provide professional medical guidance. Please feel free to ask any questions about your health status, test results, or next steps.'
      
      const parts: string[] = []
      if (latest.lifestyle) {
        const l = latest.lifestyle
        parts.push(`Lifestyle: smoking=${l.smoking}, alcohol=${l.alcohol}, exercise=${l.exercise}, diet=${l.diet}, stress=${l.stress_level}, sleep_hours=${l.sleep_hours}`)
      }
      if (latest.symptoms) {
        const symTrue = Object.entries(latest.symptoms).filter(([,v]: any)=>v).map(([k]: any)=>String(k).replace(/_/g,' '))
        parts.push(`Symptoms: ${symTrue.length ? symTrue.join(', ') : 'none reported'}`)
      }
      const opener = parts.length ? parts.join(' | ') : 'Please give general guidance based on the prediction.'
      // seed a welcome line visual then ask
      setMessages([{ role: 'ai', content: personalizedGreeting }])
      ask(opener)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Listen for changes in shared chat history from other chatbot - use separate key for triage page
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dr_intelligence_chat_history_triage' && e.newValue) {
        try {
          const parsedHistory = JSON.parse(e.newValue)
          if (parsedHistory.length > 0) {
            const historyWithDates = parsedHistory.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
            setMessages(historyWithDates)
          }
        } catch (error) {
          console.error('Error syncing shared chat history:', error)
        }
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          .triage-content {
            line-height: 1.6 !important;
          }
          
          .triage-content p {
            margin: 0 0 12px 0 !important;
            line-height: 1.6 !important;
          }
          
          .triage-content p:last-child {
            margin-bottom: 0 !important;
          }
          
          .triage-content br {
            display: block !important;
            margin: 8px 0 !important;
            content: "" !important;
          }
          
          .triage-content strong {
            font-weight: 600 !important;
            background: rgba(255,255,255,0.1) !important;
            padding: 2px 6px !important;
            border-radius: 4px !important;
            font-size: 0.95em !important;
          }
          
          .triage-content em {
            color: #94a3b8 !important;
            font-style: italic !important;
            font-size: 0.85em !important;
          }
        `
      }} />
      <div 
        className="card relative overflow-hidden group hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500" 
        style={{ 
          marginBottom: 24,
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.4)"
        }}
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-blue-500/20 transition-colors duration-500"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none group-hover:bg-purple-500/20 transition-colors duration-500"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-1 ring-white/10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight mb-1">Dr. Intelligence</h1>
              <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                AI Health Assistant
              </div>
            </div>
          </div>
          
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mb-6">
            Your professional medical guide. Ask questions about your reports, symptoms, or health goals.
          </p>

          {latest && (
            <div className="flex flex-wrap gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium flex items-center gap-2">
                <span>📊</span> Analysis: {latest.task}
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium flex items-center gap-2">
                <span>❤️</span> Health Score: {latest.prediction?.health_score?.toFixed?.(1)}/100
              </div>
              {model && (
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-medium flex items-center gap-2">
                  <span>🤖</span> {model}
                </div>
              )}
            </div>
          )}
          {!latest && (
            <div className="mt-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 flex items-center gap-3">
              <span>⚠️</span>
              No medical data available. Please upload a report or enter manual data first.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{minHeight:200, display: 'flex', flexDirection: 'column', gap: 16}}>
          {messages.map((m, i) => (
            <div 
              key={i} 
              style={{
                display: 'flex', 
                alignItems: 'flex-start', 
                gap: 12,
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row'
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: m.role === 'user' ? '#3b82f6' : '#1e40af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {m.role === 'user' ? (
                  <span style={{color: '#ffffff', fontSize: 14, fontWeight: 'bold'}}>You</span>
                ) : (
                  <span style={{color: '#ffffff', fontSize: 14, fontWeight: 'bold'}}>Dr</span>
                )}
              </div>
              
              {/* Message Bubble */}
              <div style={{
                maxWidth: '80%',
                padding: '20px 24px',
                borderRadius: m.role === 'user' ? '24px 24px 4px 24px' : '24px 24px 24px 4px',
                background: m.role === 'user' 
                  ? 'linear-gradient(135deg, #3b82f6, #2563eb)' 
                  : 'rgba(30, 41, 59, 0.7)',
                color: '#ffffff',
                fontSize: 15,
                lineHeight: 1.6,
                boxShadow: m.role === 'user' 
                  ? '0 4px 12px rgba(37, 99, 235, 0.3)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.2)',
                backdropFilter: 'blur(12px)',
                border: m.role === 'user' 
                  ? '1px solid rgba(255, 255, 255, 0.2)' 
                  : '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div style={{whiteSpace: 'pre-line', wordBreak: 'break-word', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1.6'}}>
                  <div 
                    className="triage-content" 
                    dangerouslySetInnerHTML={{ __html: m.content }} 
                    style={{
                      display: 'block',
                      lineHeight: '1.6'
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
          {error && <div className="alert" style={{marginTop:12}}>{error}</div>}
        </div>
        <div style={{display:'flex', gap:8, marginTop:16}}>
          <input
            className="input"
            placeholder="Ask Dr. Intelligence about your health..."
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'){ ask(input); setInput('') } }}
          />
          <button className="btn btn-primary" disabled={loading || !input.trim()} onClick={()=>{ ask(input); setInput('') }}>
            {loading ? (
              <span><span className="loading-spinner"></span>Thinking...</span>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
    </>
  )
}
