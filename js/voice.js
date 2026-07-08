// =============================================
// VOICE & NOTIFICATIONS
// =============================================
function speakText(text) {
  if (!state.voiceEnabled) return;
  try {
    // Tarayıcı ses sentezi desteği kontrolü
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Önceki sesleri kes
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'tr-TR';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  } catch (e) {
    console.error("Ses sentezinde hata:", e);
  }
}

function toggleVoiceSetting() {
  state.voiceEnabled = document.getElementById("settings-voice-toggle").checked;
  saveState();
  if (state.voiceEnabled) {
    speakText("Sesli bildirimler etkinleştirildi.");
  }
}
