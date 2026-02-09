# Echo-Vision: Intelligent Multimodal Assistance

**Echo-Vision** is a smart digital companion designed to empower people with visual impairments. Using the advanced reasoning of **Gemini 1.5 Flash**, it transforms visual environments into clear, spatial audio descriptions through natural voice interaction.

## Video Demo

<video src="Loom Message.mp4" width="100%" controls>
  Your browser does not support the video tag.
</video>

## Why Echo-Vision?

Traditional assistive tools often just identify objects (e.g., "A chair"). Echo-Vision goes further by **understanding context**. It doesn't just see; it reasons. Whether it's reading a prescription, finding a specific item on a cluttered desk, or navigating an unfamiliar room, Echo-Vision provides the "cognitive bridge" needed for true independence.

---

## Powered by Gemini 1.5 Flash

The heart of this project is the **Gemini 1.5 Flash API**. We chose this model for several critical reasons:

* **Native Multimodality:** Unlike older systems that need separate tools to "hear" and "see," Gemini understands audio and images simultaneously. This allows the user to ask questions naturally while the camera is active.
* **Low Latency (Speed):** For a visually impaired person, a delay of even a few seconds can be disorienting. Gemini Flash provides near-instant responses, ensuring a fluid experience.
* **Spatial Reasoning:** We programmed the system to use a "Clock-face" orientation (e.g., "Your water bottle is at 2 o'clock"). Gemini's ability to understand 3D space from 2D images makes this possible.

---

## Technical Choices & Architecture

For this project, we deliberately chose **React** and **TypeScript**, aligned with the cutting-edge ecosystem of **Google AI Studio**.

### Why this stack?
* **TypeScript:** We use TypeScript to ensure code reliability. In an accessibility app, errors can be frustrating; TypeScript helps us catch bugs early and maintain a clean, professional codebase.
* **React:** React allows us to build a highly responsive and "accessible-first" user interface. It ensures that UI updates (like analysis results) are handled efficiently.
* **Direct Web Integration:** While frameworks like *FastAPI* or *Flutter* are excellent, we chose a direct Web-to-Gemini architecture for its **portability**. Any device with a browser can become an Echo-Vision device instantly, without the friction of app store installations.

---

## Challenges We Overcame

Building an app for the visually impaired comes with unique engineering hurdles:

* **Audio-Visual Sync:** One of the main challenges was ensuring that the AI could process the user's voice query and the image frame as a single coherent intent. We solved this by leveraging Gemini’s native multimodal buffer.
* **Spatial Accuracy:** Moving from "I see a door" to "The door is 2 meters to your left" required fine-tuning our prompts. We implemented a system of "system instructions" to force the model to think in terms of spatial coordinates.
* **Voice Clarity:** We had to ensure the AI's response was not just accurate, but easy to hear. We integrated high-quality text-to-speech to ensure the output remains clear even in busy environments.

---

## Privacy & Ethics

Privacy is a fundamental right, especially for users relying on assistive technology. 

* **Minimal Data Retention:** Echo-Vision is designed to process information in real-time. Images and voice recordings are used solely to generate the assistance required and are not stored permanently by our application.
* **User Agency:** The application only captures data when the user explicitly triggers an interaction. There is no "hidden" background recording.
* **Ethical AI:** We have implemented safety filters to ensure the AI does not misidentify hazardous situations, always providing a "safety-first" disclaimer when navigation is involved.

---

## Key Features

1.  **Audio-Visual Synergy:** Upload or capture a scene and simply *speak* your question. 
2.  **Spatial Guidance:** Directions are given relative to the user's position using the intuitive clock system.
3.  **Contextual Intelligence:** Ask about specific details, like expiry dates or ingredients on a package.
4.  **Natural Voice Output:** Responses are delivered in a clear, professional English voice.

---

## Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/Shoutshi03/Echo-Vision-App.git](https://github.com/Shoutshi03/Echo-Vision-App.git)
    cd Echo-Vision-App
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Configure your API Key:**
    Create a `.env` file and add your Google AI API Key:
    ```env
    VITE_GEMINI_API_KEY=your_key_here
    ```
4.  **Run the application:**
    ```bash
    npm run dev
    ```

---

## Roadmap
* **Haptic Feedback:** Integrating phone vibrations to signal proximity to obstacles.
* **Offline Mode:** Exploring lightweight models for basic obstacle detection without internet.
* **Wearable Integration:** Adapting the interface for smart glasses.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

View your app in AI Studio: https://ai.studio/apps/drive/1SBGHfBw9I6E6YAkSptJfyRk9kxlTZsH6

---
*Developed for the Google Gemini API Hackathon.*
