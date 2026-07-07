# Prompt Engineering & AI Architecture Guide

This document outlines the detailed prompt designs, engineering workflows, and system architectures powering **SevaSetu AI**. These prompts have been engineered to ensure high precision, absolute context alignment, and robust multilingual performance.

---

## 1. Conversational Chat Agent: Vani

*   **Role**: Persistent Multilingual Civic Companion
*   **Model**: Gemini 1.5 Flash
*   **Task**: Guide citizens on government scheme eligibility, translate dense bureaucratic rules into plain language, and direct users to appropriate services.

### System Prompt Design
```
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
```

### Prompt Engineering Techniques
1.  **Role Prompting**: Establishing the identity "Vani, an empathetic civic companion" enforces a polite, supportive tone appropriate for citizens who may be frustrated or confused by government processes.
2.  **Context-Injected Grounding**: By embedding the active database of welfare schemes (`schemes_text`) directly into the system context, we eliminate hallucination. The model retrieves details exclusively from this validated set.
3.  **Structured Guidance**: Specific operational constraints (such as the length limit of 250 words and markdown bullet requirements) prevent long-winded legal outputs and optimize mobile readability.
4.  **Dynamic Multilingual Routing**: Feeding the active language variable (`language`) dynamically instructs the model to translate its base database query into regional scripts (Hindi, Kannada, Tamil, etc.) on the fly, bridging the digital literacy gap.

---

## 2. Multimodal Vision Analyzer: JanDrishti

*   **Role**: Senior Municipal Computer Vision Expert
*   **Model**: Gemini 1.5 Flash (Multimodal)
*   **Task**: Analyze user-uploaded photos of civic damage, classify the category, evaluate severity, geolocate landmarks, and draft a formal grievance letter.

### System Prompt Design
```
Analyze this civic issue photo. Give your output strictly in JSON format matching this schema:
{
  "category": "Roads & Transport" | "Sanitation & Waste" | "Utilities & Power" | "Health & Safety" | "Public Amenities",
  "title": "A concise, formal title describing the specific issue in the photo",
  "description": "A detailed 2-3 sentence description of the damage, safety implications, and visual cues",
  "severity": "Low" | "Medium" | "High" | "Critical",
  "severity_score": 1 to 10 rating,
  "confidence": 0.8 to 1.0 rating,
  "draft_letter": "A professional official grievance letter to the local municipal commissioner requesting repairs. Keep it formal and brief."
}
Do not return any markdown formatting outside the JSON, return ONLY the raw JSON structure.
```

### Prompt Engineering Techniques
1.  **Strict Output Structuring**: Using a JSON schema enforces structured data boundaries. The application backend parses the response directly into object variables to auto-fill input fields in real-time, creating a seamless UX.
2.  **Few-Shot Output Constraint**: Explicitly specifying the allowed values for categorical fields (`category`, `severity`) prevents the model from generating custom tags that would break database grouping.
3.  **Co-locational Formatting**: The request for a drafted letter alongside classification scores ensures the model executes visual evaluation and text generation in a single inference cycle, reducing API latency and cost.
4.  **Vision Prompt Grounding**: Directing the model to look for "visual cues" encourages deep inspection of images (e.g. checking if a pothole is waterlogged or near a school to gauge safety severity).

---

## 3. Iteration & Optimization History

During prototyping, the prompts went through multiple iterations to solve specific failure cases:

| Failure Mode | Root Cause | Engineering Solution |
|---|---|---|
| Model returned raw JSON wrapped in markdown ` ```json ` blocks. | Flask backend failed to parse JSON due to string wraps. | Added `responseMimeType: "application/json"` to Gemini generation config and reinforced "return ONLY raw JSON" in prompt. |
| Model recommended schemes the user did not qualify for. | Model used generic internet knowledge instead of our database. | Explicitly bound the model to the injected database and instructed: "If no match, politely state no matches in database". |
| Chatbot replied in English when asked in Hindi. | Model defaulted to English due to user's browser locale. | Injected the selected UI dropdown language directly into the prompt parameters. |
| Vision analyzer estimated low severity for deep hazardous potholes. | Lack of context about pedestrian risk. | Instructed model to evaluate safety implications and include visual hazards in description. |
