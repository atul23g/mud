import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Heart, Activity, Brain, User, FileText, TrendingUp, AlertCircle } from 'lucide-react'

interface HealthData {
  task: string
  features: Record<string, any>
  prediction: {
    label: number
    probability: number
    health_score: number
  } | null
  lifestyle: Record<string, any>
  symptoms: Record<string, boolean>
  timestamp?: string
}

interface Report {
  id: string
  task: string
  createdAt: string
  prediction?: {
    label: number
    probability: number
    health_score: number
  }
  features: Record<string, any>
}

export default function History() {
  const navigate = useNavigate()
  const [latest, setLatest] = useState<HealthData | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHealthData()
    loadReports()
  }, [])

  const loadHealthData = () => {
    try {
      const stored = localStorage.getItem('latest_result')
      if (stored) {
        const data = JSON.parse(stored)
        setLatest(data)
      }
    } catch (error) {
      console.error('Error loading health data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadReports = async () => {
    try {
      // This would typically come from your API
      // For now, we'll use localStorage data
      const storedReports = localStorage.getItem('health_reports')
      if (storedReports) {
        setReports(JSON.parse(storedReports))
      }
    } catch (error) {
      console.error('Error loading reports:', error)
    }
  }

  const getTaskIcon = (task: string) => {
    switch (task) {
      case 'heart': return <Heart className="w-5 h-5 text-red-500" />
      case 'diabetes': return <Activity className="w-5 h-5 text-blue-500" />
      case 'parkinsons': return <Brain className="w-5 h-5 text-purple-500" />
      default: return <User className="w-5 h-5 text-gray-500" />
    }
  }

  const getTaskLabel = (task: string) => {
    switch (task) {
      case 'heart': return 'Heart Health'
      case 'diabetes': return 'Diabetes Assessment'
      case 'parkinsons': return 'Neurological Health'
      case 'general': return 'General Health'
      default: return task.charAt(0).toUpperCase() + task.slice(1)
    }
  }

  const formatFeatureLabel = (key: string): string => {
    const labels: Record<string, string> = {
      'age': 'Age',
      'sex': 'Gender',
      'trestbps': 'Resting Blood Pressure',
      'chol': 'Cholesterol Level',
      'fbs': 'Fasting Blood Sugar',
      'restecg': 'Resting ECG Results',
      'thalach': 'Maximum Heart Rate',
      'exang': 'Exercise-Induced Angina',
      'oldpeak': 'ST Depression',
      'slope': 'ST Slope',
      'ca': 'Major Vessels',
      'thal': 'Thalassemia Type',
      'Pregnancies': 'Number of Pregnancies',
      'Glucose': 'Blood Glucose Level',
      'BloodPressure': 'Blood Pressure',
      'SkinThickness': 'Skin Fold Thickness',
      'Insulin': 'Insulin Level',
      'BMI': 'Body Mass Index',
      'DiabetesPedigreeFunction': 'Family Diabetes History',
      'Age': 'Age'
    }
    return labels[key] || key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatLifestyleLabel = (key: string): string => {
    const labels: Record<string, string> = {
      'smoking': 'Smoking Status',
      'alcohol': 'Alcohol Consumption',
      'exercise': 'Exercise Level',
      'diet': 'Diet Type',
      'stress_level': 'Stress Level',
      'sleep_hours': 'Sleep Duration'
    }
    return labels[key] || key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatSymptomLabel = (key: string): string => {
    const labels: Record<string, string> = {
      'chest_pain': 'Chest Pain or Discomfort',
      'shortness_of_breath': 'Shortness of Breath',
      'fatigue': 'Fatigue or Tiredness',
      'dizziness': 'Dizziness or Lightheadedness',
      'sweating': 'Excessive Sweating',
      'pain_during_exercise': 'Pain During Exercise',
      'swelling_legs': 'Swelling in Legs'
    }
    return labels[key] || key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const getRiskLevel = (label: number, probability: number) => {
    if (label === 1) {
      return { text: 'Higher Risk', color: 'text-red-600 bg-red-50', icon: <AlertCircle className="w-4 h-4" /> }
    }
    return { text: 'Lower Risk', color: 'text-green-600 bg-green-50', icon: <TrendingUp className="w-4 h-4" /> }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading health history...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Health History</h1>
        <p className="text-gray-600">Review your previous health assessments and track your wellness journey</p>
      </div>

      {!latest && (
        <div className="card">
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Health History Yet</h3>
            <p className="text-gray-600 mb-6">Start your health journey by uploading a medical report or entering your health data manually.</p>
            <div className="flex justify-center gap-4">
              <button 
                onClick={() => navigate('/upload')}
                className="btn btn-primary"
              >
                Upload Report
              </button>
              <button 
                onClick={() => navigate('/manual')}
                className="btn btn-secondary"
              >
                Enter Manually
              </button>
            </div>
          </div>
        </div>
      )}

      {latest && (
        <div className="space-y-6">
          {/* Latest Assessment Card */}
          <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                {getTaskIcon(latest.task)}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Latest Assessment</h2>
                  <p className="text-sm text-gray-600">{getTaskLabel(latest.task)} Analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>Recent</span>
              </div>
            </div>

            {latest.prediction && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg p-4 border">
                  <div className="text-2xl font-bold text-blue-600">
                    {latest.prediction.health_score?.toFixed(1) || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Health Score</div>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <div className="flex items-center gap-2">
                    {getRiskLevel(latest.prediction.label, latest.prediction.probability).icon}
                    <span className={`font-semibold ${getRiskLevel(latest.prediction.label, latest.prediction.probability).color.split(' ')[0]}`}>
                      {getRiskLevel(latest.prediction.label, latest.prediction.probability).text}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">Risk Assessment</div>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <div className="text-lg font-semibold text-gray-900">
                    {(latest.prediction.probability * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Probability</div>
                </div>
              </div>
            )}

            {/* Clinical Data */}
            {latest.features && Object.keys(latest.features).length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Clinical Data</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(latest.features)
                    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
                    .map(([key, value]) => (
                      <div key={key} className="bg-white rounded-lg p-4 border">
                        <div className="text-sm font-medium text-gray-900">{formatFeatureLabel(key)}</div>
                        <div className="text-lg font-semibold text-gray-700">{value}</div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Lifestyle Data */}
            {latest.lifestyle && Object.keys(latest.lifestyle).length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Lifestyle Factors</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(latest.lifestyle).map(([key, value]) => (
                    <div key={key} className="bg-white rounded-lg p-4 border">
                      <div className="text-sm font-medium text-gray-900">{formatLifestyleLabel(key)}</div>
                      <div className="text-lg font-semibold text-gray-700 capitalize">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Symptoms */}
            {latest.symptoms && Object.keys(latest.symptoms).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Reported Symptoms</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(latest.symptoms)
                    .filter(([_, value]) => value === true)
                    .map(([key, _]) => (
                      <span key={key} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        {formatSymptomLabel(key)}
                      </span>
                    ))}
                </div>
                {Object.entries(latest.symptoms).filter(([_, value]) => value === true).length === 0 && (
                  <p className="text-gray-600">No symptoms reported</p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button 
              onClick={() => navigate('/triage')}
              className="btn btn-primary"
            >
              Consult Dr. Intelligence
            </button>
            <button 
              onClick={() => navigate('/upload')}
              className="btn btn-secondary"
            >
              New Assessment
            </button>
          </div>
        </div>
      )}
    </div>
  )
}