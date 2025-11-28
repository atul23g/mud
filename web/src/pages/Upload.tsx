import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ingestReport, predictWithFeatures, Task } from "../lib/api";
import { getAccessToken } from "../lib/auth";
import HealthScoreChart from "../components/HealthScoreChart";
import { AlertCircle } from "lucide-react";

// Helper functions for user-friendly labels
function getUserFriendlyLabel(key: string): string {
  const labels: Record<string, string> = {
    // Heart disease
    age: "Age",
    trestbps: "Resting Blood Pressure",
    chol: "Cholesterol Level",
    fbs: "Fasting Blood Sugar",
    restecg: "Resting ECG Results",
    thalach: "Maximum Heart Rate",
    exang: "Exercise-Induced Angina",
    oldpeak: "ST Depression",
    slope: "ST Slope",
    ca: "Major Vessels",
    thal: "Thalassemia Type",

    // Diabetes
    Pregnancies: "Number of Pregnancies",
    Glucose: "Blood Glucose Level",
    BloodPressure: "Blood Pressure",
    SkinThickness: "Skin Fold Thickness",
    Insulin: "Insulin Level",
    BMI: "Body Mass Index",
    DiabetesPedigreeFunction: "Family Diabetes History",
    Age: "Age",

    // Parkinsons
    fo: "Fundamental Frequency",
    fhi: "Highest Frequency",
    flo: "Lowest Frequency",
    jitter_percent: "Voice Jitter (%)",
    jitter_abs: "Voice Jitter (Absolute)",
    rap: "Relative Amplitude Perturbation",
    ppq: "Period Perturbation Quotient",
    ddp: "Degree of Deviation",
    shimmer: "Voice Shimmer",
    shimmer_db: "Shimmer in Decibels",
    apq3: "Amplitude Perturbation Quotient 3",
    apq5: "Amplitude Perturbation Quotient 5",
    apq: "General Amplitude Perturbation",
    dda: "Degree of Deviation Amplitude",
    nhr: "Noise-to-Harmonics Ratio",
    hnr: "Harmonics-to-Noise Ratio",
    rpde: "Recurrence Period Density Entropy",
    dfa: "Detrended Fluctuation Analysis",
    spread1: "Spread 1",
    spread2: "Spread 2",
    d2: "Correlation Dimension",
    ppe: "Pitch Period Entropy",

    // General medical terms
    blood_pressure: "Blood Pressure",
    heart_rate: "Heart Rate",
    temperature: "Body Temperature",
    glucose: "Blood Glucose",
    cholesterol: "Cholesterol",
    hemoglobin: "Hemoglobin",
    wbc: "White Blood Cells",
    platelets: "Platelet Count",
    weight: "Weight",
    height: "Height",
  };

  return (
    labels[key] ||
    key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

function formatDisplayValue(key: string, value: any, task: string): string {
  // Handle chest pain type
  if (key === "cp" && task === "heart") {
    const cpTypes: Record<number, string> = {
      0: "Typical Angina",
      1: "Atypical Angina",
      2: "Non-Anginal Pain",
      3: "Asymptomatic",
    };
    return cpTypes[Number(value)] || String(value);
  }

  // Handle fasting blood sugar
  if (key === "fbs" && task === "heart") {
    return value === 1
      ? "> 120 mg/dL"
      : value === 0
      ? "<= 120 mg/dL"
      : String(value);
  }

  // Handle exercise induced angina
  if (key === "exang" && task === "heart") {
    return value === 1 ? "Yes" : value === 0 ? "No" : String(value);
  }

  // Handle thalassemia type
  if (key === "thal" && task === "heart") {
    const thalTypes: Record<number, string> = {
      0: "Normal",
      1: "Fixed Defect",
      2: "Reversible Defect",
    };
    return thalTypes[Number(value)] || String(value);
  }

  return String(value);
}

function getCategoryForKey(key: string): string {
  const k = key.toLowerCase();
  const map: Record<string, string> = {
    hba1c: "Diabetes",
    glucose: "Diabetes",
    fasting_glucose: "Diabetes",
    postprandial_glucose: "Diabetes",
    insulin: "Diabetes",
    bmi: "General",
    bloodpressure: "General",
    blood_pressure: "General",
    heart_rate: "Cardiac",
    cholesterol: "Lipid Profile",
    total_cholesterol: "Lipid Profile",
    ldl: "Lipid Profile",
    hdl: "Lipid Profile",
    triglycerides: "Lipid Profile",
    vldl: "Lipid Profile",
    alt: "Liver Function",
    ast: "Liver Function",
    alp: "Liver Function",
    ggt: "Liver Function",
    bilirubin: "Liver Function",
    direct_bilirubin: "Liver Function",
    indirect_bilirubin: "Liver Function",
    creatinine: "Kidney Function",
    urea: "Kidney Function",
    bun: "Kidney Function",
    egfr: "Kidney Function",
    sodium: "Electrolytes",
    potassium: "Electrolytes",
    chloride: "Electrolytes",
    calcium: "Electrolytes",
    tsh: "Thyroid",
    t3: "Thyroid",
    t4: "Thyroid",
    hemoglobin: "CBC",
    wbc: "CBC",
    platelets: "CBC",
  };
  return map[k] || "Other";
}

function highlightText(text: string, keys: string[]): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  const patterns = keys.map((k) => k).filter(Boolean);
  if (!patterns.length)
    return <pre style={{ whiteSpace: "pre-wrap" }}>{text}</pre>;
  const regex = new RegExp(
    `(${patterns
      .map((p) => p.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"))
      .join("|")})`,
    "gi"
  );
  let idx = 0;
  remaining.split(regex).forEach((chunk, i) => {
    const isMatch = regex.test(chunk);
    regex.lastIndex = 0;
    if (isMatch) {
      parts.push(
        <mark
          key={`m-${idx++}`}
          style={{
            background: "rgba(239,68,68,0.2)",
            color: "var(--text-primary)",
            padding: "0 2px",
            borderRadius: 4,
          }}
        >
          {chunk}
        </mark>
      );
    } else {
      parts.push(<span key={`t-${idx++}`}>{chunk}</span>);
    }
  });
  return (
    <pre
      style={{
        whiteSpace: "pre-wrap",
        background: "var(--surface)",
        padding: 12,
        borderRadius: 8,
        maxHeight: 300,
        overflow: "auto",
      }}
    >
      {parts}
    </pre>
  );
}

function getUserFriendlySymptom(key: string): string {
  const symptoms: Record<string, string> = {
    chest_pain: "Chest Pain or Discomfort",
    shortness_of_breath: "Shortness of Breath",
    fatigue: "Fatigue or Tiredness",
    dizziness: "Dizziness or Lightheadedness",
    sweating: "Excessive Sweating",
    pain_during_exercise: "Pain During Exercise",
    swelling_legs: "Swelling in Legs",
  };

  return (
    symptoms[key] ||
    key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

function getDescriptionForKey(key: string): string {
  const descriptions: Record<string, string> = {
    // Heart
    age: "Age of the patient.",
    trestbps: "Resting blood pressure (mm Hg). High values indicate hypertension.",
    chol: "Serum cholesterol (mg/dl). High levels increase heart disease risk.",
    fbs: "Fasting blood sugar. > 120 mg/dl suggests diabetes.",
    restecg: "Resting electrocardiographic results.",
    thalach: "Maximum heart rate achieved during exercise.",
    exang: "Angina induced by exercise (Yes/No).",
    oldpeak: "ST depression induced by exercise relative to rest.",
    slope: "Slope of the peak exercise ST segment.",
    ca: "Number of major vessels (0-3) colored by fluoroscopy.",
    thal: "Thalassemia status (Normal, Fixed Defect, Reversible Defect).",
    
    // Diabetes
    Pregnancies: "Number of times pregnant.",
    Glucose: "Plasma glucose concentration (2 hours in an oral glucose tolerance test).",
    BloodPressure: "Diastolic blood pressure (mm Hg).",
    SkinThickness: "Triceps skin fold thickness (mm).",
    Insulin: "2-Hour serum insulin (mu U/ml).",
    BMI: "Body mass index (weight in kg/(height in m)^2).",
    DiabetesPedigreeFunction: "Diabetes pedigree function (genetic score).",
    Age: "Age of the patient.",

    // General / Common
    hemoglobin: "Protein in red blood cells that carries oxygen.",
    wbc: "White blood cell count. High values may indicate infection.",
    platelets: "Platelet count. Important for blood clotting.",
    creatinine: "Waste product filtered by kidneys. High levels may indicate kidney issues.",
    alt: "Liver enzyme. High levels may indicate liver damage.",
    ast: "Liver enzyme. High levels may indicate liver damage.",
    tsh: "Thyroid stimulating hormone. Regulates thyroid function.",
  };
  
  return descriptions[key] || "Medical indicator extracted from report.";
}

function getReferenceRange(key: string, task: string): { min: number; max: number } | null {
  const ranges: Record<string, Record<string, { min: number; max: number }>> = {
    diabetes: {
      Glucose: { min: 70, max: 99 },
      glucose: { min: 70, max: 99 },
      BloodPressure: { min: 80, max: 120 },
      blood_pressure: { min: 80, max: 120 },
      Insulin: { min: 16, max: 166 },
      insulin: { min: 16, max: 166 },
      BMI: { min: 18.5, max: 24.9 },
      bmi: { min: 18.5, max: 24.9 },
    },
    heart: {
      trestbps: { min: 90, max: 120 },
      chol: { min: 125, max: 200 },
      cholesterol: { min: 125, max: 200 },
      thalach: { min: 100, max: 180 },
    },
  };

  const taskRanges = ranges[task];
  if (!taskRanges) return null;
  
  return taskRanges[key] || null;
}


export default function Upload() {
  const navigate = useNavigate();
  const location = useLocation();
  const [task, setTask] = useState<Task>("heart");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [features, setFeatures] = useState<Record<string, any>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [extractedMeta, setExtractedMeta] = useState<
    Record<
      string,
      { value: any; unit?: string | null; confidence?: number; source?: string }
    >
  >({});
  const [rawText, setRawText] = useState<string>("");
  const [outOfRange, setOutOfRange] = useState<string[]>([]);
  const [allExtracted, setAllExtracted] = useState<Record<string, any> | null>(null);
  const [showExtractedValues, setShowExtractedValues] = useState(false);
  // AI Doctor moved to its own page (Triage). Here we just show a CTA.
  // Lifestyle & Symptoms
  const [lifestyle, setLifestyle] = useState({
    smoking: "no",
    alcohol: "no",
    exercise: "medium",
    diet: "balanced",
    stress_level: "medium",
    sleep_hours: 7,
  });
  const [symptoms, setSymptoms] = useState({
    chest_pain: false,
    shortness_of_breath: false,
    fatigue: false,
    dizziness: false,
    sweating: false,
    pain_during_exercise: false,
    swelling_legs: false,
  });
  const [advice, setAdvice] = useState<{
    summary: string;
    followups: string[];
    model_name: string;
  } | null>(null);

  const haveIngest = useMemo(() => !!reportId, [reportId]);
  const havePred = useMemo(() => !!result?.pred, [result]);

  // Simple validation: require missing fields to be filled; numeric check for known numeric fields per task
  const numericFieldsByTask: Record<Task, Set<string>> = {
    heart: new Set(["age", "trestbps", "chol", "thalach", "oldpeak", "ca"]),
    diabetes: new Set([
      "Pregnancies",
      "Glucose",
      "BloodPressure",
      "SkinThickness",
      "Insulin",
      "BMI",
      "DiabetesPedigreeFunction",
      "Age",
    ]),
    parkinsons: new Set([
      "fo",
      "fhi",
      "flo",
      "jitter_percent",
      "jitter_abs",
      "rap",
      "ppq",
      "ddp",
      "shimmer",
      "shimmer_db",
      "apq3",
      "apq5",
      "apq",
      "dda",
      "nhr",
      "hnr",
      "rpde",
      "dfa",
      "spread1",
      "spread2",
      "d2",
      "ppe",
    ]),
    general: new Set<string>(),
  };
  const invalidMissing = useMemo(() => {
    if (!haveIngest) return [] as string[];
    const nums = numericFieldsByTask[task];
    const bad: string[] = [];
    for (const k of missing) {
      // Skip age validation since it's hidden
      if (k === "age" || k === "Age") continue;
      const v = (features as any)[k];
      if (v === "" || v === null || v === undefined) {
        bad.push(k);
        continue;
      }
      if (nums.has(k)) {
        const n = Number(v);
        if (!Number.isFinite(n)) bad.push(k);
      }
    }
    return bad;
  }, [haveIngest, missing, features, task]);
  const canAnalyze =
    haveIngest && invalidMissing.length === 0 && task !== "general";

  // Confidence grouping from extractedMeta - now including high confidence fields for confirmation
  const groups = useMemo(() => {
    const high: string[] = [];
    const medium: string[] = [];
    const low: string[] = [];
    Object.keys(extractedMeta || {}).forEach((k) => {
      if (missing.includes(k)) return;
      const c = extractedMeta[k]?.confidence;
      if (typeof c !== "number") return;
      if (c >= 0.95) high.push(k);
      else if (c >= 0.9) medium.push(k);
      else low.push(k);
    });
    return { high, medium, low };
  }, [extractedMeta, missing]);

  // Include all extracted fields for confirmation (high confidence fields are now optional confirmation)
  const optionalConfirmationKeys = useMemo(() => {
    const allKeys = [...groups.high, ...groups.medium];
    return allKeys.filter((k) => k !== "sex");
  }, [groups.high, groups.medium]);

  // Treat low-confidence fields and missing fields as required inputs
  const requiredKeys = useMemo(() => {
    const set = new Set<string>([...missing, ...groups.low]);
    const filtered = Array.from(set).filter((k) => k !== "sex");
    return filtered;
  }, [missing, groups.low]);

  const groupedKeys = useMemo(() => {
    const groups: Record<string, string[]> = {};
    Object.keys(extractedMeta || {}).forEach((k) => {
      const cat = getCategoryForKey(k);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(k);
    });
    return groups;
  }, [extractedMeta]);

  const patientName = useMemo(() => {
    const metaNames = ["patient_name", "name", "patient"];
    for (const n of metaNames) {
      const v = (extractedMeta as any)[n]?.value || (extractedMeta as any)[n];
      if (v && typeof v === "string") return v;
    }
    const fn = (file as any)?.name as string | undefined;
    if (fn)
      return fn
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();
    return "there";
  }, [extractedMeta, file]);

  const renderAskMeaning = (key: string) => (
    <button
      className="btn btn-secondary"
      onClick={() =>
        navigate("/triage", {
          state: {
            reportData: {
              task,
              features,
              prediction: result?.pred
                ? {
                    label: result.pred.label,
                    probability: result.pred.probability,
                    health_score: result.pred.health_score,
                  }
                : null,
              prediction_id: result?.pred?.prediction_id,
              lifestyle,
              symptoms,
            },
          },
        })
      }
      style={{ padding: "4px 8px", fontSize: 12 }}
      title={`Ask AI: What is ${getUserFriendlyLabel(key)}?`}
    >
      ?
    </button>
  );

  useEffect(() => {
    const state = (location as any).state;
    const report = state?.report;
    if (report) {
      setTask((report.task || "general") as Task);
      setReportId(report.id);
      
      const feats = report.extracted || report.features || {};
      setFeatures(feats);
      setMissing(report.missingFields || []);
      
      // Backfill extractedMeta if missing (e.g. from localStorage) so fields show up
      let meta = report.extractedMeta || {};
      if (Object.keys(meta).length === 0 && Object.keys(feats).length > 0) {
        const newMeta: any = {};
        Object.keys(feats).forEach((k) => {
          newMeta[k] = { value: feats[k], confidence: 1.0, unit: null };
        });
        meta = newMeta;
      }
      setExtractedMeta(meta);

      setRawText(report.rawOCR?.text || report.extracted_text || "");
      
      // Handle highlights/out of range
      const highlights = report.highlights || Object.entries(report.extractedMeta || {})
        .filter(([_, v]: any) => v?.out_of_range)
        .map(([k]) => k as string);
      setOutOfRange(highlights);
      
      setShowExtractedValues(true);

      // If prediction exists, set it to show results immediately
      if (report.prediction) {
        setResult({ pred: report.prediction });
        setShowExtractedValues(false); 
      }
    }
  }, [location]);

  const onSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = await getAccessToken();
      const ingest = await ingestReport(task, file, token);
      setReportId(ingest.report_id);
      // initialize features with extracted + placeholders for missing
      const f: Record<string, any> = { ...(ingest.extracted || {}) };
      (ingest.missing_fields || []).forEach((k: string) => {
        if (!(k in f)) f[k] = "";
      });
      setFeatures(f);
      setMissing(ingest.missing_fields || []);
      setExtractedMeta(ingest.extracted_meta || {});
      setRawText(ingest.raw_text || "");
      setOutOfRange(ingest.out_of_range_fields || []);
      setOutOfRange(ingest.out_of_range_fields || []);
      
      setShowExtractedValues(false); // Hide values by default
      // In general mode, stash context immediately for Triage
      if (task === "general") {
        localStorage.setItem(
          "latest_result",
          JSON.stringify({
            task,
            features: f,
            prediction: null,
            prediction_id: null,
            lifestyle,
            symptoms,
            extracted_text: ingest.raw_text || "",
            highlights: ingest.out_of_range_fields || [],
          })
        );
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const onAnalyze = async () => {
    if (!haveIngest) return;



    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const pred = await predictWithFeatures(
        task,
        features,
        reportId || undefined,
        token
      );
      setResult({ pred });
      // stash for triage page
      localStorage.setItem(
        "latest_result",
        JSON.stringify({
          task,
          features,
          prediction: {
            label: pred.label,
            probability: pred.probability,
            health_score: pred.health_score,
          },
          prediction_id: pred.prediction_id,
          lifestyle,
          symptoms,
          extracted_text: rawText,
          highlights: outOfRange,
        })
      );
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || "Analyze failed");
    } finally {
      setLoading(false);
    }
  };

  const onGetAdvice = () => {
    if (!havePred) return;
    // Pass current report data to triage page in the same structure as localStorage
    const reportData = {
      task,
      features,
      prediction: result?.pred
        ? {
            label: result.pred.label,
            probability: result.pred.probability,
            health_score: result.pred.health_score,
          }
        : null,
      prediction_id: result?.pred?.prediction_id,
      lifestyle,
      symptoms,
    };
    navigate("/triage", { state: { reportData } });
  };

  return (
    <>
      <div 
        className="card relative overflow-hidden group hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500" 
        style={{ 
          marginBottom: 32,
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
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-1 ring-white/10">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight mb-1">
                  AI Health Assistant
                </h2>
                <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  Ready to assist
                </div>
              </div>
            </div>
            <p className="text-gray-400 text-lg leading-relaxed max-w-2xl">
              Get personalized health insights and advice. Ask questions about your reports and health in plain language.
            </p>
          </div>

          <button
            onClick={() => navigate("/triage", { state: { reportData: result } })}
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold text-lg transition-all duration-300 hover:bg-blue-50 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-white/50 active:scale-95"
          >
            <span>Start Consultation</span>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <svg className="w-4 h-4 text-blue-600 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>
        </div>
      </div>

      <div className="card" style={{ 
        background: "rgba(30, 41, 59, 0.7)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 24,
        padding: 32,
        boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.3)"
      }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 32,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800, background: "linear-gradient(to right, #60a5fa, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Upload Medical Report
            </h2>
            <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", fontSize: 16 }}>
              Upload your lab results for instant AI analysis
            </p>
          </div>
          
          {/* Enhanced 3-step indicator */}
          {(() => {
            const step = !haveIngest ? 1 : !havePred ? 2 : 3;
            const dot = (active: boolean, label: string, num: number) => (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: active ? "linear-gradient(135deg, #3b82f6, #8b5cf6)" : "rgba(255,255,255,0.05)",
                    border: active ? "none" : "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: active ? "white" : "var(--text-muted)",
                    fontWeight: 700,
                    fontSize: 14,
                    boxShadow: active ? "0 4px 12px rgba(59, 130, 246, 0.4)" : "none",
                    transition: "all 0.3s ease",
                  }}
                >
                  {step > num ? "✓" : num}
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: active ? "var(--text-primary)" : "var(--text-muted)",
                    fontWeight: active ? 600 : 400,
                    letterSpacing: "0.02em"
                  }}
                >
                  {label}
                </span>
              </div>
            );
            return (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                {dot(step >= 1, "Upload", 1)}
                <div style={{ width: 40, height: 2, background: step >= 2 ? "var(--primary)" : "rgba(255,255,255,0.1)", marginTop: 15, borderRadius: 1 }} />
                {dot(step >= 2, "Review", 2)}
                <div style={{ width: 40, height: 2, background: step >= 3 ? "var(--primary)" : "rgba(255,255,255,0.1)", marginTop: 15, borderRadius: 1 }} />
                {dot(step >= 3, "Results", 3)}
              </div>
            );
          })()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="col-span-1">
            <label
              style={{ fontWeight: 600, marginBottom: 12, display: "block", color: "var(--text-primary)", fontSize: 15 }}
            >
              Select Health Focus
            </label>
            <div className="relative group">
              <select
                className="input w-full appearance-none cursor-pointer"
                style={{ 
                  height: 56, 
                  padding: "0 20px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 16,
                  transition: "all 0.2s ease"
                }}
                value={task}
                onChange={(e) => setTask(e.target.value as Task)}
              >
                <option value="general">🩺 General Health Assessment</option>
                <option value="heart">❤️ Heart Health & Cardiovascular</option>
                <option value="diabetes">🩸 Diabetes & Blood Sugar</option>
                <option value="parkinsons">🧠 Neurological Health</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </div>
            <div
              style={{ marginTop: 12, fontSize: 14, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8, padding: "12px", background: "rgba(59, 130, 246, 0.05)", borderRadius: 12, border: "1px solid rgba(59, 130, 246, 0.1)" }}
            >
              <span style={{ fontSize: 18 }}>ℹ️</span>
              {task === "general" && "Comprehensive health analysis across all areas"}
              {task === "heart" && "Focus on heart disease risk and cardiovascular health"}
              {task === "diabetes" && "Diabetes risk assessment and blood sugar analysis"}
              {task === "parkinsons" && "Neurological condition assessment"}
            </div>
          </div>

          <div className="col-span-1">
            <label
              style={{ fontWeight: 600, marginBottom: 12, display: "block", color: "var(--text-primary)", fontSize: 15 }}
            >
              Upload PDF Report
            </label>
            <div 
              className="relative group cursor-pointer"
              style={{
                border: "2px dashed rgba(255,255,255,0.15)",
                borderRadius: 20,
                padding: "32px 24px",
                textAlign: "center",
                background: "rgba(255,255,255,0.02)",
                transition: "all 0.2s ease"
              }}
            >
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  if (f && f.type && f.type !== "application/pdf") {
                    setError("Please upload a PDF file (.pdf)");
                    setFile(null);
                    return;
                  }
                  setFile(f);
                }}
              />
              <div className="pointer-events-none">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform duration-200">
                  {file ? (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  ) : (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  )}
                </div>
                <p style={{ margin: "0 0 4px", fontWeight: 600, color: file ? "var(--primary-light)" : "var(--text-primary)" }}>
                  {file ? file.name : "Click to upload or drag and drop"}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF files only (max 10MB)"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className={`btn btn-primary ${loading ? "btn-loading" : ""}`}
            disabled={!file || loading}
            onClick={onSubmit}
            style={{
              padding: "14px 32px",
              fontSize: 16,
              borderRadius: 12,
              background: !file ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              border: "none",
              opacity: !file && !loading ? 0.5 : 1,
              boxShadow: file ? "0 8px 20px -4px rgba(59, 130, 246, 0.5)" : "none",
              transition: "all 0.3s ease",
              transform: file ? "translateY(0)" : "none",
            }}
          >
            {loading ? (
              <span>
                <span className="loading-spinner"></span>Analyzing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                📤 Analyze Report
              </span>
            )}
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: 16 }}>
            ⚠️ {error}
          </div>
        )}



        {/* Extracted values summary and confidence-driven review */}
        {haveIngest && (
          <div style={{ marginTop: 24 }}>
            {task === "general" && (
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                ℹ️ General Health Mode: We've extracted all available health
                data from your report. Click "Get Health Advice" to receive
                personalized guidance from our AI assistant.
              </div>
            )}

            {task !== "general" && (
              <div style={{ marginTop: 24 }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                  <h3 className="text-lg font-bold text-white">Required Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...optionalConfirmationKeys, ...requiredKeys].sort().map((k) => (
                    <div key={k} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-blue-500/30 transition-colors">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {getUserFriendlyLabel(k)}
                        {requiredKeys.includes(k) && <span className="text-red-400 ml-1">*</span>}
                      </label>
                      <input
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                        type="text"
                        value={features[k] ?? ""}
                        onChange={(e) =>
                          setFeatures((prev) => ({
                            ...prev,
                            [k]: e.target.value,
                          }))
                        }
                        style={
                          invalidMissing.includes(k)
                            ? { borderColor: "var(--error)" }
                            : undefined
                        }
                      />
                    </div>
                  ))}
                </div>
                
                {invalidMissing.length > 0 && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>
                      Please provide valid values for:{" "}
                      {invalidMissing
                        .map((k) => getUserFriendlyLabel(k))
                        .join(", ")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Lifestyle & Symptoms */}
            <div style={{ marginTop: 32 }}>
              <details 
                open 
                className="group"
                style={{ marginBottom: 24 }}
              >
                <summary
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    cursor: "pointer",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "var(--surface)",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    transition: "all 0.2s ease"
                  }}
                  className="hover:border-blue-500/50 hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="transform transition-transform duration-200 group-open:rotate-180">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </div>
                    <span>Lifestyle Factors</span>
                  </div>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 400 }}>
                    Optional • Improves AI Accuracy
                  </span>
                </summary>
                
                <div 
                  style={{
                    background: "rgba(30, 41, 59, 0.4)",
                    backdropFilter: "blur(12px)",
                    borderRadius: 12,
                    padding: 24,
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    boxShadow: "0 4px 24px -1px rgba(0, 0, 0, 0.2)"
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Smoking Status
                      </label>
                      <select
                        className="input w-full"
                        style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)" }}
                        value={lifestyle.smoking}
                        onChange={(e) =>
                          setLifestyle((s) => ({ ...s, smoking: e.target.value }))
                        }
                      >
                        <option value="no">Non-smoker</option>
                        <option value="yes">Smoker</option>
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Alcohol Consumption
                      </label>
                      <select
                        className="input w-full"
                        style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)" }}
                        value={lifestyle.alcohol}
                        onChange={(e) =>
                          setLifestyle((s) => ({ ...s, alcohol: e.target.value }))
                        }
                      >
                        <option value="no">None / Rare</option>
                        <option value="yes">Occasional / Regular</option>
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Exercise Level
                      </label>
                      <select
                        className="input w-full"
                        style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)" }}
                        value={lifestyle.exercise}
                        onChange={(e) =>
                          setLifestyle((s) => ({
                            ...s,
                            exercise: e.target.value,
                          }))
                        }
                      >
                        <option value="low">Low (Sedentary)</option>
                        <option value="medium">Moderate (2-3x/week)</option>
                        <option value="high">High (Active)</option>
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Diet Type
                      </label>
                      <select
                        className="input w-full"
                        style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)" }}
                        value={lifestyle.diet}
                        onChange={(e) =>
                          setLifestyle((s) => ({ ...s, diet: e.target.value }))
                        }
                      >
                        <option value="balanced">Balanced</option>
                        <option value="veg">Vegetarian</option>
                        <option value="non-veg">Non-vegetarian</option>
                        <option value="high-fat">High Fat</option>
                        <option value="junk">Processed / Fast Food</option>
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Stress Level
                      </label>
                      <select
                        className="input w-full"
                        style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)" }}
                        value={lifestyle.stress_level}
                        onChange={(e) =>
                          setLifestyle((s) => ({
                            ...s,
                            stress_level: e.target.value,
                          }))
                        }
                      >
                        <option value="low">Low</option>
                        <option value="medium">Moderate</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Sleep Duration (Hours)
                      </label>
                      <input
                        className="input w-full"
                        style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)" }}
                        type="number"
                        min={0}
                        max={24}
                        value={lifestyle.sleep_hours}
                        onChange={(e) =>
                          setLifestyle((s) => ({
                            ...s,
                            sleep_hours: Number(e.target.value || 0),
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </details>

              <details className="group">
                <summary
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    cursor: "pointer",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    background: "var(--surface)",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    transition: "all 0.2s ease"
                  }}
                  className="hover:border-blue-500/50 hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="transform transition-transform duration-200 group-open:rotate-180">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </div>
                    <span>Current Symptoms</span>
                  </div>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 400 }}>
                    Select all that apply
                  </span>
                </summary>
                
                <div 
                  style={{
                    background: "rgba(30, 41, 59, 0.4)",
                    backdropFilter: "blur(12px)",
                    borderRadius: 12,
                    padding: 24,
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    boxShadow: "0 4px 24px -1px rgba(0, 0, 0, 0.2)"
                  }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.keys(symptoms).map((k) => (
                      <label
                        key={k}
                        className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-white/5 border border-transparent hover:border-white/10"
                      >
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded border-gray-500 text-blue-600 focus:ring-blue-500 bg-gray-700"
                          checked={(symptoms as any)[k]}
                          onChange={(e) =>
                            setSymptoms((prev) => ({
                              ...prev,
                              [k]: e.target.checked,
                            }))
                          }
                        />
                        <span className="text-gray-200 select-none">
                          {getUserFriendlySymptom(k)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </details>

              <div style={{ marginTop: 24 }}>
                {task === "general" ? (
                  <button
                    className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 p-[1px] transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/25 hover:scale-[1.02]"
                    onClick={() =>
                      navigate("/triage", { state: { reportData: result } })
                    }
                  >
                    <div className="relative flex items-center justify-center gap-3 bg-slate-900/50 backdrop-blur-sm px-6 py-4 rounded-[11px] transition-all duration-300 group-hover:bg-transparent">
                      <span className="text-2xl">💡</span>
                      <span className="font-bold text-white text-lg">Get Personalized Health Advice</span>
                      <svg className="w-5 h-5 text-white/70 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </div>
                  </button>
                ) : (
                  <button
                    className={`btn btn-primary ${
                      loading ? "btn-loading" : ""
                    }`}
                    disabled={!canAnalyze || loading}
                    onClick={onAnalyze}
                  >
                    {loading ? (
                      <span>
                        <span className="loading-spinner"></span>Analyzing your
                        health data...
                      </span>
                    ) : (
                      <span>🔬 Get Health Analysis</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {haveIngest && (
        <>
          {result && result.pred && (
            <>
              <HealthScoreChart
                task={task}
                features={features}
                prediction={result.pred}
              />

              <div className="card" style={{ marginTop: 24 }}>
                <div style={{ marginTop: 24 }}>
                  <button
                    className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 p-[1px] transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02]"
                    onClick={onGetAdvice}
                    disabled={loading}
                  >
                    <div className="relative flex items-center justify-center gap-3 bg-slate-900/50 backdrop-blur-sm px-6 py-4 rounded-[11px] transition-all duration-300 group-hover:bg-transparent">
                      {loading ? (
                        <>
                          <span className="loading-spinner"></span>
                          <span className="font-bold text-white text-lg">Opening AI Health Assistant...</span>
                        </>
                      ) : (
                        <>
                          <span className="text-2xl">💬</span>
                          <span className="font-bold text-white text-lg">Get Personalized Health Advice</span>
                          <svg className="w-5 h-5 text-white/70 transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                          </svg>
                        </>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Extracted Values Section - Show when we have extraction data */}
          {haveIngest && (
            <div style={{ marginTop: 24 }}>
              {/* Out of Range Alert - Always visible if there are abnormal values */}
              {outOfRange && outOfRange.length > 0 && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  <strong>⚠️ Abnormal Values Detected:</strong>{" "}
                  {outOfRange.map((k) => getUserFriendlyLabel(k)).join(", ")}
                </div>
              )}


              {/* Extracted Report Text - Card-based layout with ranges */}
              {Object.keys(extractedMeta).length > 0 && (
                <details className="group" open style={{ marginTop: 16 }}>
                  <summary
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      cursor: "pointer",
                      marginBottom: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "var(--surface)",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      transition: "all 0.2s ease"
                    }}
                    className="hover:border-blue-500/50 hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="transform transition-transform duration-200 group-open:rotate-180">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </div>
                      <span>📊 Extracted Medical Values</span>
                    </div>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        background: "rgba(255,255,255,0.05)",
                        padding: "4px 10px",
                        borderRadius: "20px"
                      }}
                    >
                      {Object.keys(extractedMeta).length} values
                    </span>
                  </summary>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ marginTop: 16 }}>
                    {Object.keys(extractedMeta).map((key) => {
                      const meta = extractedMeta[key];
                      const isAbnormal = outOfRange?.includes(key);
                      const range = getReferenceRange(key, task);
                      
                      return (
                        <div
                          key={key}
                          className={`relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-[1.02] ${
                            isAbnormal 
                              ? "bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30" 
                              : "bg-slate-800/50 border border-slate-700/50"
                          }`}
                          style={{
                            animation: isAbnormal ? "pulse-yellow 2s ease-in-out infinite" : "none"
                          }}
                        >
                          {isAbnormal && (
                            <div className="absolute top-2 right-2">
                              <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded text-xs font-medium border border-yellow-500/30">
                                Out of Range
                              </span>
                            </div>
                          )}
                          
                          <div className="mb-3">
                            <span className="text-gray-300 font-semibold text-sm block">
                              {getUserFriendlyLabel(key)}
                            </span>
                          </div>
                          
                          <div className="mb-3">
                            <span className={`text-3xl font-bold tracking-tight ${isAbnormal ? "text-yellow-400" : "text-white"}`}>
                              {formatDisplayValue(key, meta.value, task)}
                            </span>
                            {meta.unit && (
                              <span className="text-sm text-gray-400 font-normal ml-2">
                                {meta.unit}
                              </span>
                            )}
                          </div>

                          {range && (
                            <div className="mb-2 p-2 bg-slate-900/50 rounded-lg">
                              <span className="text-xs text-gray-400 block mb-1">Reference Range:</span>
                              <span className="text-xs text-gray-300 font-medium">
                                {range.min} - {range.max} {meta.unit || ""}
                              </span>
                            </div>
                          )}

                          <div className="text-xs text-gray-500 leading-relaxed mt-2">
                            {getDescriptionForKey(key)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}

              {/* Extracted Report Text - All extracted values from report */}
              {(rawText || (allExtracted && Object.keys(allExtracted).length > 0)) && (
                <details className="group" style={{ marginTop: 16 }}>
                  <summary
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      cursor: "pointer",
                      marginBottom: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "var(--surface)",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      transition: "all 0.2s ease"
                    }}
                    className="hover:border-blue-500/50 hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="transform transition-transform duration-200 group-open:rotate-180">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </div>
                      <span>📄 Extracted Report Text</span>
                    </div>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                        background: "rgba(255,255,255,0.05)",
                        padding: "4px 10px",
                        borderRadius: "20px"
                      }}
                    >
                      {allExtracted ? Object.keys(allExtracted).length : 0} values
                    </span>
                  </summary>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ marginTop: 16 }}>
                    {allExtracted && Object.keys(allExtracted).map((key) => {
                      // Handle tuple format (value, unit) or direct value
                      const valData = allExtracted[key];
                      let value = valData;
                      let unit = "";
                      
                      if (Array.isArray(valData) && valData.length >= 1) {
                        value = valData[0];
                        if (valData.length >= 2) unit = valData[1];
                      }

                      const range = getReferenceRange(key, task);
                      
                      return (
                        <div
                          key={key}
                          className="relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-[1.02] bg-slate-800/50 border border-slate-700/50"
                        >
                          <div className="mb-3">
                            <span className="text-gray-300 font-semibold text-sm block">
                              {getUserFriendlyLabel(key)}
                            </span>
                          </div>
                          
                          <div className="mb-3">
                            <span className="text-3xl font-bold tracking-tight text-white">
                              {formatDisplayValue(key, value, task)}
                            </span>
                            {unit && (
                              <span className="text-sm text-gray-400 font-normal ml-2">
                                {unit}
                              </span>
                            )}
                          </div>

                          {range && (
                            <div className="mb-2 p-2 bg-slate-900/50 rounded-lg">
                              <span className="text-xs text-gray-400 block mb-1">Reference Range:</span>
                              <span className="text-xs text-gray-300 font-medium">
                                {range.min} - {range.max} {unit || ""}
                              </span>
                            </div>
                          )}

                          <div className="text-xs text-gray-500 leading-relaxed mt-2">
                            {getDescriptionForKey(key)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}



            </div>
          )}


        </>
      )}
    </>
  );
}
