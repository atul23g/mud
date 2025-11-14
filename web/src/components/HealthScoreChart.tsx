import React from 'react'

interface HealthScoreChartProps {
  task: string
  features: Record<string, any>
  prediction: {
    label: number
    probability: number
    health_score: number
    top_contributors: string[]
  }
}

const HealthScoreChart: React.FC<HealthScoreChartProps> = ({ task, features, prediction }) => {
  const getFeatureImportance = () => {
    switch (task) {
      case 'heart':
        return [
          { name: 'Cholesterol', value: features.chol || 0, unit: 'mg/dL', importance: 85 },
          { name: 'Blood Pressure', value: features.trestbps || 0, unit: 'mmHg', importance: 72 },
          { name: 'Max Heart Rate', value: features.thalach || 0, unit: 'bpm', importance: 45 },
          { name: 'Chest Pain Type', value: features.cp || 0, unit: '', importance: 38 }
        ]
      case 'diabetes':
        return [
          { name: 'Glucose Level', value: features.Glucose || 0, unit: 'mg/dL', importance: 92 },
          { name: 'BMI', value: features.BMI || 0, unit: '', importance: 78 },
          { name: 'Blood Pressure', value: features.BloodPressure || 0, unit: 'mmHg', importance: 60 },
          { name: 'Age', value: features.Age || 0, unit: 'years', importance: 42 },
          { name: 'Skin Thickness', value: features.SkinThickness || 0, unit: 'mm', importance: 30 }
        ]
      case 'parkinsons':
        return [
          { name: 'Voice Jitter', value: features.jitter_percent || 0, unit: '%', importance: 90 },
          { name: 'Voice Shimmer', value: features.shimmer || 0, unit: '', importance: 76 },
          { name: 'Noise Ratio', value: features.nhr || 0, unit: '', importance: 59 },
          { name: 'RPDE', value: features.rpde || 0, unit: '', importance: 41 },
          { name: 'DFA', value: features.dfa || 0, unit: '', importance: 33 }
        ]
      default:
        return []
    }
  }

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return '#10b981' // green
    if (score >= 60) return '#f59e0b' // yellow
    if (score >= 40) return '#f97316' // orange
    return '#ef4444' // red
  }

  const getRiskColor = (label: number) => {
    return label === 1 ? '#ef4444' : '#10b981'
  }

  const formatValue = (name: string, value: number, unit: string) => {
    if (name === 'Chest Pain Type') {
      return value
    }
    return `${value} ${unit}`
  }

  const featureImportance = getFeatureImportance()
  const healthScoreColor = getHealthScoreColor(prediction.health_score)
  const riskColor = getRiskColor(prediction.label)

  return (
    <div style={{
      backgroundColor: '#1e293b',
      borderRadius: '16px',
      padding: '24px',
      marginTop: '24px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
    }}>
      {/* Health Score and Risk Assessment */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        marginBottom: '24px',
        paddingBottom: '24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: `conic-gradient(${healthScoreColor} ${prediction.health_score * 3.6}deg, #374151 ${prediction.health_score * 3.6}deg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            backgroundColor: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column'
          }}>
            <div style={{
              fontSize: '28px',
              fontWeight: '800',
              color: healthScoreColor,
              lineHeight: '1'
            }}>
              {prediction.health_score.toFixed(1)}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#94a3b8',
              marginTop: '4px'
            }}>
              Health Score
            </div>
          </div>
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '20px',
            fontWeight: '700',
            marginBottom: '8px',
            color: riskColor
          }}>
            {prediction.label === 1 ? '⚠️ Health Risk Detected' : '✅ Low Risk Assessment'}
          </div>
          <div style={{
            fontSize: '16px',
            color: '#94a3b8',
            marginBottom: '12px'
          }}>
            Risk Probability: {(prediction.probability * 100).toFixed(1)}%
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: riskColor,
              animation: 'pulse 2s infinite'
            }} />
            <span style={{
              fontSize: '14px',
              color: '#cbd5e1'
            }}>
              {prediction.label === 1 ? 'Immediate attention recommended' : 'Continue monitoring your health'}
            </span>
          </div>
        </div>
      </div>

      {/* Feature Importance Chart */}
      {featureImportance.length > 0 && (
        <div>
          <div style={{
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '16px',
            color: '#f8fafc'
          }}>
            Key Health Indicators:
          </div>
          
          <div style={{ marginBottom: '12px' }}>
            {featureImportance.map((feature, index) => (
              <div key={feature.name} style={{
                marginBottom: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px'
                }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#e2e8f0'
                  }}>
                    {feature.name}
                  </span>
                  <span style={{
                    fontSize: '12px',
                    color: '#94a3b8'
                  }}>
                    {formatValue(feature.name, feature.value, feature.unit)}
                  </span>
                </div>
                
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#374151',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    backgroundColor: feature.importance >= 80 ? '#ef4444' : 
                                   feature.importance >= 60 ? '#f97316' :
                                   feature.importance >= 40 ? '#f59e0b' : '#10b981',
                    width: `${feature.importance}%`,
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '4px'
                }}>
                  <span style={{
                    fontSize: '11px',
                    color: '#64748b'
                  }}>
                    Impact Level
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#cbd5e1'
                  }}>
                    {feature.importance}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Health Status Summary */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        borderLeft: `4px solid ${healthScoreColor}`
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#f8fafc',
          marginBottom: '8px'
        }}>
          Health Status Summary
        </div>
        <div style={{
          fontSize: '13px',
          color: '#cbd5e1',
          lineHeight: '1.5'
        }}>
          {prediction.health_score >= 80 ? 
            'Your health indicators are within optimal ranges. Maintain your current lifestyle and continue regular monitoring.' :
          prediction.health_score >= 60 ?
            'Some health metrics need attention. Consider lifestyle modifications and consult with healthcare providers for preventive care.' :
          prediction.health_score >= 40 ?
            'Several health indicators require immediate attention. Schedule a consultation with your healthcare provider for proper evaluation.' :
            'Critical health indicators detected. Seek immediate medical consultation for comprehensive evaluation and treatment planning.'
          }
        </div>
      </div>
    </div>
  )
}

export default HealthScoreChart