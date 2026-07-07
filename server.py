import os
import json
import base64
import requests
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, redirect
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='static', static_url_path='/static')

# In-memory session key store for runtime configuration
RUNTIME_CONFIG = {
    "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY", ""),
    "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", "")
}

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
SCHEMES_FILE = os.path.join(DATA_DIR, 'schemes.json')
COMPLAINTS_FILE = os.path.join(DATA_DIR, 'complaints.json')

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(app.static_folder, 'assets'), exist_ok=True)

# In-memory fallbacks for serverless environments (like Vercel)
IN_MEMORY_COMPLAINTS = None
IN_MEMORY_SCHEMES = None

# Helper function to read json files
def read_json(filepath, default=[]):
    global IN_MEMORY_COMPLAINTS, IN_MEMORY_SCHEMES
    
    if filepath == COMPLAINTS_FILE and IN_MEMORY_COMPLAINTS is not None:
        return IN_MEMORY_COMPLAINTS
    if filepath == SCHEMES_FILE and IN_MEMORY_SCHEMES is not None:
        return IN_MEMORY_SCHEMES
        
    if not os.path.exists(filepath):
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(default, f, indent=2)
        except Exception as e:
            print(f"Serverless environment detected (read-only filesystem): {e}")
            if filepath == COMPLAINTS_FILE:
                IN_MEMORY_COMPLAINTS = default
            elif filepath == SCHEMES_FILE:
                IN_MEMORY_SCHEMES = default
            return default
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if filepath == COMPLAINTS_FILE:
                IN_MEMORY_COMPLAINTS = data
            elif filepath == SCHEMES_FILE:
                IN_MEMORY_SCHEMES = data
            return data
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return default

# Helper function to write json files
def write_json(filepath, data):
    global IN_MEMORY_COMPLAINTS, IN_MEMORY_SCHEMES
    
    if filepath == COMPLAINTS_FILE:
        IN_MEMORY_COMPLAINTS = data
    elif filepath == SCHEMES_FILE:
        IN_MEMORY_SCHEMES = data
        
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"Disk write skipped (Serverless Mode), saved in-memory: {e}")
        return True

# Serve Single Page Application index.html
@app.route('/')
def index():
    # If index.html doesn't exist, we send a basic greeting for safety
    index_path = os.path.join(app.static_folder, 'index.html')
    if not os.path.exists(index_path):
        return "Frontend files not created yet. Please wait.", 404
    return app.send_static_file('index.html')

# Get schemes API
@app.route('/api/schemes', methods=['GET'])
def get_schemes():
    schemes = read_json(SCHEMES_FILE)
    return jsonify(schemes)

# Get complaints API
@app.route('/api/complaints', methods=['GET'])
def get_complaints():
    complaints = read_json(COMPLAINTS_FILE)
    return jsonify(complaints)

# Save custom configuration API (allows direct entry of API keys from dashboard)
@app.route('/api/config', methods=['GET', 'POST'])
def handle_config():
    if request.method == 'GET':
        return jsonify({
            "has_gemini": bool(RUNTIME_CONFIG["GEMINI_API_KEY"]),
            "has_openai": bool(RUNTIME_CONFIG["OPENAI_API_KEY"])
        })
    else:
        data = request.json or {}
        if "gemini_key" in data:
            RUNTIME_CONFIG["GEMINI_API_KEY"] = data["gemini_key"].strip()
        if "openai_key" in data:
            RUNTIME_CONFIG["OPENAI_API_KEY"] = data["openai_key"].strip()
        return jsonify({"status": "success", "message": "API keys updated successfully."})

# Create new complaint API
@app.route('/api/complaints', methods=['POST'])
def create_complaint():
    complaints = read_json(COMPLAINTS_FILE)
    new_data = request.json or {}
    
    comp_id = f"comp-{len(complaints) + 101}"
    now_str = datetime.utcnow().isoformat() + "Z"
    
    complaint = {
        "id": comp_id,
        "title": new_data.get("title", "Untitled Civic Issue"),
        "category": new_data.get("category", "General"),
        "description": new_data.get("description", ""),
        "location": new_data.get("location", "Unknown Location"),
        "latitude": new_data.get("latitude", 12.9716),
        "longitude": new_data.get("longitude", 77.5946),
        "severity": new_data.get("severity", "Medium"),
        "status": "Submitted",
        "submitted_by": new_data.get("submitted_by", "Citizen Sathi"),
        "submitted_at": now_str,
        "timeline": [
            { "status": "Submitted", "timestamp": now_str, "note": "Complaint registered successfully." }
        ],
        "image_path": new_data.get("image_path", "/static/assets/default_issue.jpg"),
        "ai_verification": new_data.get("ai_verification", {
            "verified": True,
            "category_detected": new_data.get("category", "General"),
            "severity_score": 5,
            "confidence": 0.90,
            "draft_letter": "AI generated letter placeholder."
        })
    }
    
    complaints.insert(0, complaint) # Put new complaints at the top
    write_json(COMPLAINTS_FILE, complaints)
    return jsonify(complaint), 201

# Update complaint status API (Municipal Admin simulator)
@app.route('/api/complaints/<comp_id>/status', methods=['POST'])
def update_complaint_status(comp_id):
    complaints = read_json(COMPLAINTS_FILE)
    data = request.json or {}
    new_status = data.get("status")
    note = data.get("note", f"Complaint status updated to {new_status}")
    
    found = False
    for comp in complaints:
        if comp["id"] == comp_id:
            comp["status"] = new_status
            now_str = datetime.utcnow().isoformat() + "Z"
            comp["timeline"].append({
                "status": new_status,
                "timestamp": now_str,
                "note": note
            })
            found = True
            break
            
    if found:
        write_json(COMPLAINTS_FILE, complaints)
        return jsonify({"status": "success", "complaint": comp})
    return jsonify({"status": "error", "message": "Complaint not found"}), 404

# Core chat API: handles conversational questions with Gemini API
@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json or {}
    user_message = data.get("message", "").strip()
    history = data.get("history", [])
    language = data.get("language", "English")
    
    if not user_message:
        return jsonify({"status": "error", "message": "Message empty"}), 400
        
    api_key = RUNTIME_CONFIG["GEMINI_API_KEY"] or os.getenv("GEMINI_API_KEY")
    
    if api_key:
        try:
            # We construct a rich context prompt about our schemes and database to make Gemini act as an expert companion
            schemes = read_json(SCHEMES_FILE)
            schemes_text = json.dumps(schemes, indent=2)
            
            system_prompt = f"""
You are Vani, a helpful, polite, and empathetic GenAI Civic Companion for 'SevaSetu AI'.
Your goal is to assist Indian citizens in accessing government services, understanding welfare schemes, and reporting civic issues.
You have access to the following schemes database:
{schemes_text}

Rules:
1. Answer citizen questions clearly, in simple terms. Avoid complex jargon.
2. If a citizen asks about eligibility, match them against the fields in the schemes database (age, state, income, gender, occupation).
3. If they want to report a complaint (pothole, garbage, dark streetlights), explain that they can use the 'Report Issue' tab at the top.
4. Support the language requested by the user: '{language}'. Even if the query is in English, if the user requested '{language}', answer in that language.
5. Provide a summary of documents needed if they ask about applying.
6. Keep replies relatively concise (under 250 words) and format them with clean bullet points and markdown.
"""
            
            # Format chat history
            contents = []
            # We feed the system instructions in the first user turn or system instruction block
            contents.append({
                "role": "user",
                "parts": [{"text": system_prompt + "\n\nLet's start the conversation."}]
            })
            contents.append({
                "role": "model",
                "parts": [{"text": "Namaste! I am Vani, your SevaSetu AI companion. How can I help you today?"}]
            })
            
            # Append prior history
            for h in history[-6:]: # Keep last 6 exchanges to save tokens
                contents.append({
                    "role": "user" if h["sender"] == "user" else "model",
                    "parts": [{"text": h["text"]}]
                })
                
            contents.append({
                "role": "user",
                "parts": [{"text": user_message}]
            })
            
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": contents,
                "generationConfig": {
                    "temperature": 0.4,
                    "maxOutputTokens": 1000
                }
            }
            
            response = requests.post(url, headers=headers, json=payload, timeout=15)
            if response.status_code == 200:
                res_data = response.json()
                reply = res_data['candidates'][0]['content']['parts'][0]['text']
                return jsonify({"reply": reply, "simulated": False})
            else:
                print(f"Gemini API error: {response.text}")
                # Fallback to simulation if external API call fails
                raise Exception("External API failed")
                
        except Exception as e:
            print(f"Error contacting Gemini, falling back to simulation: {e}")
            # Fallback to simulation continues below
            
    # SMART SIMULATED CO-PILOT FALLBACK
    reply = run_smart_simulation_chat(user_message, language)
    return jsonify({"reply": reply, "simulated": True})

# AI vision analysis for complaints
@app.route('/api/report_vision', methods=['POST'])
def report_vision():
    data = request.json or {}
    image_base64 = data.get("image") # base64 data url e.g. "data:image/jpeg;base64,..."
    filename = data.get("filename", "").lower()
    reporter_name = data.get("reporter_name", "Citizen")
    location_desc = data.get("location", "Near Sector Park")
    
    if not image_base64:
        return jsonify({"status": "error", "message": "No image uploaded"}), 400
        
    api_key = RUNTIME_CONFIG["GEMINI_API_KEY"] or os.getenv("GEMINI_API_KEY")
    
    # Extract raw base64 data and mime type
    mime_type = "image/jpeg"
    raw_base64 = image_base64
    if "," in image_base64:
        header, raw_base64 = image_base64.split(",", 1)
        if "image/png" in header:
            mime_type = "image/png"
        elif "image/webp" in header:
            mime_type = "image/webp"
            
    if api_key:
        try:
            prompt = """
Analyze this civic issue photo. Give your output strictly in JSON format matching this schema:
{
  "category": "Roads & Transport" or "Sanitation & Waste" or "Utilities & Power" or "Health & Safety" or "Public Amenities",
  "title": "A concise, formal title describing the specific issue in the photo",
  "description": "A detailed 2-3 sentence description of the damage, safety implications, and visual cues",
  "severity": "Low" or "Medium" or "High" or "Critical",
  "severity_score": 1 to 10 rating,
  "confidence": 0.8 to 1.0 rating,
  "draft_letter": "A professional official grievance letter to the local municipal commissioner requesting repairs. Keep it formal and brief."
}
Do not return any markdown formatting outside the JSON, return ONLY the raw JSON structure.
"""
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {
                            "inlineData": {
                                "mimeType": mime_type,
                                "data": raw_base64
                            }
                        }
                    ]
                }],
                "generationConfig": {
                    "responseMimeType": "application/json"
                }
            }
            
            response = requests.post(url, headers=headers, json=payload, timeout=20)
            if response.status_code == 200:
                res_json = response.json()
                ai_text = res_json['candidates'][0]['content']['parts'][0]['text']
                # Clean up any potential markdown wraps
                ai_text = ai_text.strip()
                if ai_text.startswith("```json"):
                    ai_text = ai_text[7:]
                if ai_text.endswith("```"):
                    ai_text = ai_text[:-3]
                ai_text = ai_text.strip()
                
                ai_result = json.loads(ai_text)
                return jsonify({
                    "success": True,
                    "simulated": False,
                    "analysis": ai_result
                })
            else:
                print(f"Gemini Vision API error: {response.text}")
                raise Exception("Vision API status error")
                
        except Exception as e:
            print(f"Vision API error, falling back to simulated analysis: {e}")
            
    # HIGH-FIDELITY SIMULATION BASED ON FILENAME
    analysis = run_smart_simulation_vision(filename, reporter_name, location_desc)
    return jsonify({
        "success": True,
        "simulated": True,
        "analysis": analysis
    })

# Helpers for Smart Fallback Simulation
def run_smart_simulation_chat(message, language):
    msg = message.lower()
    
    # Determine general responses in Hindi/English
    is_hindi = "hindi" in language.lower() or any(k in msg for k in ["namaste", "aap", "kaise", "scheme", "madad"])
    
    # 1. Farmer / Agriculture
    if any(k in msg for k in ["kisan", "farmer", "crop", "land", "farming", "agriculture"]):
        if is_hindi:
            return """**PM-Kisan योजना (किसान सम्मान निधि)** के बारे में जानकारी:
*   **लाभ:** योग्य किसानों को प्रति वर्ष ₹6,000 की वित्तीय सहायता तीन समान किस्तों में दी जाती है।
*   **पात्रता मानदंड:**
    *   आवेदक के पास अपने नाम पर खेती योग्य भूमि होनी चाहिए।
    *   वार्षिक आय ₹3,00,000 से कम होनी चाहिए।
    *   सरकारी नौकरी या आयकरदाता इसके पात्र नहीं हैं।
*   **आवश्यक दस्तावेज:** आधार कार्ड, भूमि के कागजात (खतौनी), बैंक खाता पासबुक और मोबाइल नंबर।
*   **आवेदन कैसे करें:** आप pmkisan.gov.in पर जाकर स्वयं पंजीकरण कर सकते हैं या निकटतम जन सेवा केंद्र (CSC) जा सकते हैं।

क्या आप इस योजना के लिए अपनी पात्रता जांचना चाहते हैं? आप 'Scheme Matcher' टैब का उपयोग कर सकते हैं!"""
        else:
            return """Here is information on **PM-Kisan Samman Nidhi**:
*   **Benefits:** Financial support of ₹6,000 per year, paid in three equal installments of ₹2,000 directly into the bank accounts of small/marginal farmers.
*   **Eligibility:**
    *   Must own cultivable land in your name.
    *   Annual family income should ideally be under ₹3,00,000.
    *   Excludes institutional landowners, government employees, and income tax payers.
*   **Documents Required:** Aadhaar Card, Land ownership papers (Khasra/Khatauni), Bank Passbook, and Mobile Number.
*   **How to Apply:** Register online at pmkisan.gov.in or visit a local Common Service Center (CSC).

Would you like me to guide you on how to apply?"""

    # 2. Health / Insurance
    elif any(k in msg for k in ["health", "hospital", "medical", "insurance", "ayushman", "treatment", "bimar", "ill"]):
        if is_hindi:
            return """**आयुष्मान भारत (PM-JAY)** के बारे में जानकारी:
*   **लाभ:** प्रत्येक पात्र परिवार को प्रति वर्ष ₹5 लाख तक का मुफ्त कैशलेस स्वास्थ्य बीमा मिलता है।
*   **पात्रता मानदंड:**
    *   कच्चे मकान वाले परिवार, भूमिहीन श्रमिक, या असंगठित क्षेत्र के मजदूर।
    *   वार्षिक आय ₹1,80,000 से कम होनी चाहिए।
*   **दस्तावेज:** आधार कार्ड, राशन कार्ड, आय प्रमाण पत्र और परिवार पहचान पत्र।
*   **आवेदन कैसे करें:** आप सूचीबद्ध सरकारी या निजी अस्पताल में जाकर 'आयुष्मान मित्र' से मिल सकते हैं।

यह पूरी तरह से कैशलेस योजना है। क्या आप जानना चाहते हैं कि आपके पास कौन से अस्पताल उपलब्ध हैं?"""
        else:
            return """Here is information on **Ayushman Bharat (PM-JAY)**:
*   **Benefits:** Free cashless health insurance cover of up to ₹5,00,000 per family per year for secondary and tertiary care hospitalization.
*   **Eligibility:**
    *   Covers poor, marginalized families identified by SECC 2011 (e.g. unorganized laborers, landless households, families living in kutcha rooms).
    *   Annual family income should be under ₹1,80,000.
*   **Documents Required:** Aadhaar Card, Ration Card, Income Certificate, and Family ID.
*   **How to Apply:** Visit any empanelled public/private hospital and consult the designated 'Ayushman Mitra' desk.

It provides cashless treatment at all empanelled hospitals. Do you need help finding one?"""

    # 3. Housing / Awas
    elif any(k in msg for k in ["house", "home", "housing", "awas", "pmay", "ghar", "makan"]):
        if is_hindi:
            return """**प्रधानमंत्री आवास योजना (PMAY)** के बारे में जानकारी:
*   **लाभ:** पक्के मकान के निर्माण के लिए ₹1.2 लाख से ₹1.3 लाख की प्रत्यक्ष वित्तीय सहायता या गृह ऋण ब्याज दर पर 6.5% तक की सब्सिडी।
*   **पात्रता:** भारत में कहीं भी स्वयं का पक्का घर नहीं होना चाहिए। वार्षिक पारिवारिक आय ₹6,00,000 से कम होनी चाहिए।
*   **दस्तावेज:** आधार कार्ड, पैन कार्ड, आय प्रमाण पत्र, और शपथ पत्र कि आपके पास कोई पक्का मकान नहीं है।
*   **आवेदन:** आप pmaymis.gov.in पर ऑनलाइन आवेदन कर सकते हैं या अपने स्थानीय नगर पालिका कार्यालय जा सकते हैं।"""
        else:
            return """Here is information on **Pradhan Mantri Awas Yojana (PMAY)**:
*   **Benefits:** Direct financial subsidy (up to ₹1.3 Lakhs) or interest subsidy (up to 6.5%) on housing loans to build a permanent (pucca) home.
*   **Eligibility:**
    *   Must not own a brick/pucca house anywhere in India.
    *   Annual family income should be under ₹6,00,000.
*   **Documents Required:** Aadhaar Card, PAN Card, Income Certificate, and an affidavit declaring no ownership of other houses.
*   **How to Apply:** Apply on the official PMAY online portal or visit your local municipal office."""

    # 4. Pension
    elif any(k in msg for k in ["pension", "retire", "old", "atal", "apy", "budha"]):
        if is_hindi:
            return """**अटल पेंशन योजना (APY)** के बारे में जानकारी:
*   **लाभ:** 60 वर्ष की आयु के बाद प्रति माह ₹1,000 से ₹5,000 की गारंटीकृत मासिक पेंशन।
*   **पात्रता:** आयु 18 से 40 वर्ष के बीच होनी चाहिए। एक वैध बैंक खाता होना चाहिए और आप आयकरदाता नहीं होने चाहिए।
*   **दस्तावेज:** आधार कार्ड, बैंक पासबुक और मोबाइल नंबर।
*   **आवेदन:** अपने बैंक शाखा में जाकर APY फॉर्म जमा करें।"""
        else:
            return """Here is information on **Atal Pension Yojana (APY)**:
*   **Benefits:** Guaranteed monthly pension of ₹1,000 to ₹5,000 after reaching the age of 60, based on contribution age.
*   **Eligibility:**
    *   Must be between 18 and 40 years old.
    *   Must have a savings bank account and must not be an income taxpayer.
*   **Documents Required:** Aadhaar Card, Bank savings passbook.
*   **How to Apply:** Visit the bank branch where you hold your savings account to enroll."""

    # 5. Generic Help
    else:
        if is_hindi:
            return """नमस्ते! मैं **वाणी** हूँ, आपकी सेवासेतु नागरिक सहचरी। 
मैं निम्नलिखित में आपकी सहायता कर सकती हूँ:
1.  **सरकारी योजनाएं खोजना:** आप 'Scheme Matcher' टैब में जाकर अपनी पात्रता देख सकते हैं, या मुझसे किसी योजना (जैसे किसान निधि, आयुष्मान भारत, पेंशन) के बारे में पूछ सकते हैं।
2.  **नागरिक शिकायत दर्ज करना:** सड़क पर गड्ढे, कचरा, या खराब स्ट्रीटलाइट की फोटो 'Report Issue' में अपलोड करें। हमारी AI तुरंत शिकायत पत्र तैयार कर देगी।
3.  **दस्तावेजों की जांच:** किसी योजना के लिए क्या कागज चाहिए, यह जानने के लिए मुझसे पूछें।

आप मुझसे क्या पूछना चाहते हैं?"""
        else:
            return """Namaste! I am **Vani**, your SevaSetu AI Companion.
I can assist you with:
1.  **Finding Welfare Schemes**: Tell me your profile details (age, income, occupation) or use the **Scheme Matcher** wizard to find qualifying central/state benefits.
2.  **Reporting Civic Grievances**: Head to the **Report Issue** tab to upload a photo of public issues (potholes, water leaks, uncollected trash). The AI will auto-categorize it and draft a grievance letter for you.
3.  **Document Guidelines**: Ask me what forms or certificates you need for any specific welfare scheme.

How can I assist you today? Feel free to ask in English, Hindi, or any regional language!"""

def run_smart_simulation_vision(filename, reporter_name, location_desc):
    category = "Roads & Transport"
    title = "Pothole Repair Request"
    severity = "High"
    severity_score = 7
    desc = f"Large road deformation identified at {location_desc}. Accumulates water during rains, posing a slip and crash risk for motorbikes."
    dept = "Municipal Road Maintenance Division"
    subject = "Urgent road leveling and pothole repair required"
    details = "This road requires immediate repair to avoid serious accidents. Please deploy an engineering crew."
    
    if "garbage" in filename or "trash" in filename or "waste" in filename or "dump" in filename:
        category = "Sanitation & Waste"
        title = "Overflowing Garbage Clearing Request"
        severity = "Medium"
        severity_score = 5
        desc = f"Unattended garbage bin overflowing at {location_desc}. Creating bad odor, attracting vermin, and blocking pedestrian footpaths."
        dept = "Solid Waste Management Division"
        subject = "Urgent clearing of overflowing waste bins"
        details = "The trash bins have not been cleared, causing health hazards in the locality. Kindly direct sanitation trucks to clear this site immediately."
        
    elif "light" in filename or "lamp" in filename or "streetlight" in filename or "dark" in filename:
        category = "Utilities & Power"
        title = "Streetlight Blackout Remediation"
        severity = "Medium"
        severity_score = 6
        desc = f"Street lighting fixture non-functional opposite {location_desc}. The street is dark, creating safety hazards during late hours."
        dept = "Electrical Maintenance & Utilities Division"
        subject = "Repair of non-functional public streetlight"
        details = "The streetlight is out, creating dark spots that increase security concerns. Kindly replace the LED fixture."
        
    elif "water" in filename or "leak" in filename or "pipe" in filename:
        category = "Utilities & Power"
        title = "Public Water Pipe Leakage"
        severity = "High"
        severity_score = 8
        desc = f"Burst drinking water pipeline or open sewer leak observed at {location_desc}, causing loss of fresh water and waterlogging on the road."
        dept = "Water Supply & Sewerage Board"
        subject = "Urgent repair of leaking water main line"
        details = "Drinking water is leaking onto the road. Please dispatch plumbing repair technicians to seal the line."

    draft_letter = f"""To,
The Assistant Commissioner,
{dept},
Municipal Corporation.

Subject: {subject} at {location_desc}

Dear Sir/Madam,

I am writing to draw your attention to a critical civic issue: {title}. 
{desc} {details}

We request your office to look into this matter urgently and restore service. Location details and photographs are attached for verification.

Sincerely,
{reporter_name}"""

    return {
        "category_detected": category,
        "title": title,
        "description": desc,
        "severity": severity,
        "severity_score": severity_score,
        "confidence": 0.95,
        "draft_letter": draft_letter
    }

if __name__ == '__main__':
    # Initialize JSON files if missing
    read_json(SCHEMES_FILE, default=[])
    read_json(COMPLAINTS_FILE, default=[])
    
    port = int(os.getenv("PORT", 5000))
    print(f"Starting SevaSetu AI backend on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)
