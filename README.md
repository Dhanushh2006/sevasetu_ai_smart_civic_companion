# SevaSetu AI: Smart Civic Companion

> **Smart Bharat Platform** – Bridging citizens and civic services through intelligent, multilingual AI.

**SevaSetu AI** is a GenAI-powered civic portal designed to make digital governance accessible, transparent, and actionable for all Indian citizens. By leveraging multimodal AI, SevaSetu AI simplifies social welfare scheme discovery, automates public infrastructure complaint filing from photos, and bridges accessibility divides with multilingual audio support.

---

## 🌟 Key Features

*   **Vani (Multilingual AI Companion)**: Persistently floating conversational assistant supporting voice dictation (STT) and responses read aloud (TTS) in regional languages (English, Hindi, Kannada, Tamil, Telugu, Bengali, Marathi).
*   **JanDrishti (Multimodal Civic Reporter)**: Visual diagnostic tool. Drag and drop photos of potholes, waste dumps, or broken streetlights. The AI reads visual cues, auto-categorizes, rates severity, and drafts an official grievance letter.
*   **Scheme Setu (Dynamic Profile Matcher)**: Profile questionnaire wizard (filters state, age, income, gender, occupation) to instantly check eligibility for central and state welfare programs with simple document checklists.
*   **Heatmap & Chart Diagnostics**: Interactive Leaflet maps with visual severity markers and Chart.js analytical charts showcasing category distributions.
*   **Officer Control Station**: Built-in municipal administrative simulator that lets evaluators dispatch crew units, update status timelines, and log resolution notes in a closed-loop citizen-government interface.
*   **Portable Off-grid Architecture**: Designed with a dual-operating mode. Uses direct Gemini/OpenAI API bindings if keys are configured, otherwise falls back to a smart, rule-based simulation engine.

---

## 🛠️ Technology Stack

*   **Backend Framework**: Python 3.13 + Flask
*   **Frontend Interface**: Single Page Application (HTML5, CSS3, ES6+ JS)
*   **Interactive Maps**: Leaflet.js
*   **Metrics Visualizations**: Chart.js
*   **Icon Assets**: Lucide Icons
*   **GenAI Engine**: Gemini 1.5 Flash API (Direct requests) / OpenAI Python Client
*   **Local Storage**: Portability-focused JSON file database (`data/`)

---

## 📂 Directory Layout

```
/
├── server.py             # Flask Web Server & API proxy routing
├── requirements.txt      # Python package dependencies
├── .env                  # Port, API keys, and environment flags
├── project_description.md# Detailed project description & impact analysis
├── prompts_engineering.md# Technical analysis of prompt methodologies
├── data/
│   ├── schemes.json      # Welfare schemes data (PM-Kisan, Ayushman Bharat, PMAY, APY)
│   └── complaints.json   # Seeded civic complaints database
└── static/
    ├── index.html        # Main SPA interface dashboard
    ├── css/
    │   └── styles.css    # Premium CSS design token styles & animations
    ├── js/
    │   └── app.js        # Core SPA router, maps, charts, and speech controllers
    └── assets/
        ├── pothole.jpg   # Seeded asset
        ├── garbage.jpg   # Seeded asset
        └── broken_light.jpg # Seeded asset
```

---

## 🚀 Installation & Quickstart

### 1. Clone the repository
Navigate into your desired folder:
```bash
cd "c:\Users\yathi\OneDrive\Documents\Davengers Hackathon"
```

### 2. Install dependencies
Install Python packages:
```bash
pip install -r requirements.txt
```

### 3. Configure API Credentials (Optional)
Open the `.env` file in the root directory and add your Gemini API Key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
*Note: If left blank, the app will run in simulated AI mode. You can also save credentials in-app using the Settings page.*

### 4. Run the application
Start the Flask development server:
```bash
python server.py
```

### 5. Access the app
Open your web browser and navigate to:
```
http://127.0.0.1:5000
```

## ☁️ Vercel Deployment

This project is pre-configured to be deployed as a serverless Flask application on **Vercel** via the included [vercel.json](file:///c:/Users/yathi/OneDrive/Documents/Davengers%20Hackathon/vercel.json) configuration.

### Steps to Deploy:
1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```
2. **Login and Link Project**:
   Run the following command in the project root:
   ```bash
   vercel
   ```
   Follow the command prompts to log in and configure a new project.
3. **Configure Environment Variables**:
   In the Vercel Dashboard, navigate to **Settings > Environment Variables** and add:
   * `GEMINI_API_KEY`: *(Optional)* Your Google Gemini API Key.
4. **Deploy to Production**:
   Deploy the final build online:
   ```bash
   vercel --prod
   ```

> [!NOTE]
> Serverless containers operate on a read-only filesystem. SevaSetu AI contains an automatic disk write-back handler: when running on Vercel, it saves all submissions in-memory, ensuring complaint registrations and admin simulator dispatch logs remain 100% functional on serverless deploys.

---

## 🔍 How to Test AI Vision Offline
When running in simulated mode, you can test the AI vision triggers by uploading files named:
*   `pothole.jpg` or `road.jpg` -> Roads & Transport category
*   `garbage.jpg` or `trash.jpg` -> Sanitation & Waste category
*   `light.jpg` or `streetlight.jpg` -> Utilities & Power category
*   `water.jpg` or `leak.jpg` -> Utilities & Power (Water) category

---

## 🗺️ Future Roadmap

*   **SMS/WhatsApp Chat Bot**: Integrate Vani with Twilio to serve citizens on feature phones without internet access.
*   **Decentralized Escalations**: Track complaint status updates using a public blockchain ledger to ensure administrative accountability.
*   **Government Portal Integrations**: Establish webhooks linking resolved reports directly to municipal work scheduling APIs.

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE details.
