speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'de-DE';
        utter.rate = 0.8;
        const voices = window.speechSynthesis.getVoices();
        const germanVoice = voices.find(v => v.lang.includes('de') && v.name.includes('Google')) ||
                           voices.find(v => v.lang.includes('de'));
        if (germanVoice) utter.voice = germanVoice;
        window.speechSynthesis.speak(utter);
    }
},

// Чтобы голоса подгрузились
initSpeech() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
    }
}