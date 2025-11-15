import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const REPETITION_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30, 6: 90 };

window.App = {
    db: null,
    userId: null,
    userProgress: {},
    carouselSets: [],
    unlockedWeek: 0,
    hasCompletedTrial: false,
    sessionCards: [],
    currentCardIndex: 0,
    isPracticeMode: false,
    currentHintImage: null,

    async init() {
        const cfg = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        if (Object.keys(cfg).length) {
            const app = initializeApp(cfg);
            this.db = getFirestore(app);
        }

        this.userId = Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || "test_" + Date.now();
        await this.loadCarouselSets();
        if (this.db) await this.loadUserData();
        this.initSpeech();
        this.renderHomeScreen();
    },

    initSpeech() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
        }
    },

    speak(text) {
        if (!text || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'de-DE';
        utter.rate = 0.85;
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.includes('de') && v.name.includes('Google')) ||
                      voices.find(v => v.lang.includes('de'));
        if (voice) utter.voice = voice;
        window.speechSynthesis.speak(utter);
    },

    async loadUserData() {
        try {
            const ref = doc(this.db, 'users', this.userId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const d = snap.data();
                this.hasCompletedTrial = d.hasCompletedTrial || false;
                this.userProgress = d.cards || {};
                if (d.isPaid && d.paidAt) {
                    const days = Math.floor((Date.now() - d.paidAt.toDate()) / 86400000);
                    this.unlockedWeek = Math.min(52, Math.floor(days / 7) + 1);
                }
            }
        } catch (e) { console.error(e); }
        this.renderDueToday();
    },

    async saveProgress() {
        if (!this.db) return;
        await setDoc(doc(this.db, 'users', this.userId), {
            hasCompletedTrial: this.hasCompletedTrial,
            cards: this.userProgress,
            updatedAt: serverTimestamp()
        }, { merge: true });
    },

    async loadCarouselSets() {
        try {
            const res = await fetch('carousel_sets.json');
            this.carouselSets = await res.json();
        } catch (e) { console.error("Не загрузился carousel_sets.json", e); }
    },

    renderHomeScreen() {
        this.showScreen('home-screen');
        const block = document.getElementById('main-content-block');
        block.innerHTML = '';

        if (!this.hasCompletedTrial) {
            block.innerHTML = `<button onclick="location.href='trial.html'" class="w-full py-12 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-3xl shadow-2xl text-3xl font-bold">Пробный урок<br><span class="text-xl opacity-90">Бесплатно!</span></button>`;
        } else if (this.unlockedWeek === 0) {
            block.innerHTML = `<button onclick="Telegram.WebApp.openLink('https://t.me/your_payment_bot')" class="w-full py-12 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-3xl shadow-2xl text-3xl font-bold">Открыть весь курс<br><span class="text-xl">52 недели • Новые каждую неделю</span></button>`;
        } else {
            block.innerHTML = `<button onclick="window.App.renderWeeklySelections()" class="w-full py-12 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-3xl shadow-2xl text-3xl font-bold">Продолжить<br><span class="text-5xl font-black">Неделя ${this.unlockedWeek}</span></button>`;
        }
        this.renderDueToday();
    },

    renderDueToday() {
        const today = new Date().toISOString().split('T')[0];
        const due = [];

        this.carouselSets.forEach(set => {
            if (!set.cards) return;
            const dueCount = set.cards.filter(c => {
                const key = c.word + c.translation;
                const p = this.userProgress[key];
                return p?.nextReview && p.nextReview <= today;
            }).length;
            if (dueCount > 0) due.push({ set, dueCount });
        });

        const section = document.getElementById('due-today-section');
        const list = document.getElementById('due-today-list');
        if (due.length === 0) { section.classList.add('hidden'); return; }
        section.classList.remove('hidden');
        list.innerHTML = '';
        due.forEach(item => {
            const div = document.createElement('div');
            div.className = "bg-white rounded-xl shadow p-4 flex justify-between items-center cursor-pointer hover:shadow-lg transition";
            div.innerHTML = `<span class="font-bold">${item.set.title}</span><span class="text-red-600 font-bold">${item.dueCount} к повторению</span>`;
            div.onclick = () => this.startSession(item.set.id, 'repeat');
            list.appendChild(div);
        });
    },

    renderWeeklySelections() {
        this.showScreen('weekly-screen');
        this.renderBackButton('renderHomeScreen()');
        const list = document.getElementById('weekly-list');
        list.innerHTML = '';

        for (let w = 1; w <= 8; w++) {
            const isUnlocked = (w === 1) || (w <= this.unlockedWeek);
            list.innerHTML += `
                <div class="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <h3 class="text-2xl font-bold mb-4">Неделя ${w}${w === 1 ? ' (открыта всем)' : ''}</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <button onclick="alert('Описание недели ${w}')" class="py-4 bg-gray-200 rounded-xl font-bold text-gray-700">Подробнее</button>
                        <button onclick="window.App.openWeek(${w})"
                                class="py-4 rounded-xl font-bold transition ${isUnlocked 
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                                    : 'bg-gray-400 text-gray-700'}">
                            ${isUnlocked ? 'Учить' : 'Заблокировано'}
                        </button>
                    </div>
                </div>`;
        }
    },

    openWeek(week) {
        if (week === 1) {
            location.href = 'Text1.html';
        } else if (week <= this.unlockedWeek) {
            location.href = `week${week}.html`;
        } else {
            this.showLockedModal();
        }
    },

    renderAllSetsScreen() {
        document.getElementById('list-title').textContent = 'Все наборы слов';
        this.renderBackButton('renderHomeScreen()');
        const list = document.getElementById('content-list');
        list.innerHTML = '<p class="text-center py-8 text-gray-500">Загрузка...</p>';

        this.carouselSets.forEach(async set => {
            if (!set.cards) {
                const res = await fetch(set.filepath);
                set.cards = await res.json();
            }
            const div = document.createElement('div');
            div.className = "bg-white rounded-2xl shadow-lg p-6 flex justify-between items-center mb-4";
            div.innerHTML = `
                <div>
                    <div class="font-bold text-xl">${set.title}</div>
                    <div class="text-gray-600">${set.cards.length} слов</div>
                </div>
                <button onclick="window.App.startSession('${set.id}', 'practice')" 
                        class="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold shadow-lg">
                    Учить
                </button>
            `;
            list.appendChild(div);
        });
        this.showScreen('list-screen');
    },

    async startSession(setId, mode) {
        const set = this.carouselSets.find(s => s.id === setId);
        if (!set.cards) {
            const res = await fetch(set.filepath);
            set.cards = await res.json();
        }

        let cards = mode === 'practice' ? set.cards : set.cards.filter(c => {
            const key = c.word + c.translation;
            const p = this.userProgress[key];
            const today = new Date().toISOString().split('T')[0];
            return p?.nextReview && p.nextReview <= today;
        });

        if (cards.length === 0) {
            alert(mode === 'practice' ? 'Нет слов' : 'Сегодня нет повторений');
            return;
        }

        this.sessionCards = cards.map(c => ({...c}));
        this.sessionCards.sort(() => Math.random() - 0.5);
        this.currentCardIndex = 0;
        this.isPracticeMode = mode === 'practice';
        this.showScreen('study-screen');
        this.showNextCard();
    },

    showNextCard() {
        if (this.currentCardIndex >= this.sessionCards.length) {
            this.showScreen('finish-screen');
            return;
        }

        const card = this.sessionCards[this.currentCardIndex];
        const progress = (this.currentCardIndex + 1) / this.sessionCards.length * 100;
        document.getElementById('progress-bar').style.width = `${progress}%`;

        const cardInner = document.getElementById('card-inner');
        cardInner.classList.remove('is-flipped');
        cardInner.style.transition = 'none';
        cardInner.offsetHeight;
        cardInner.style.transition = '';

        document.getElementById('controls-show').classList.remove('hidden');
        document.getElementById('controls-rate').classList.add('hidden');

        document.getElementById('card-front-text').textContent = card.word;
        document.getElementById('card-back-text').textContent = card.translation;

        const hintBtn = document.getElementById('hint-button');
        if (card.image) {
            hintBtn.classList.remove('hidden');
            this.currentHintImage = card.image;
        } else {
            hintBtn.classList.add('hidden');
            this.currentHintImage = null;
        }
    },

    showAnswer() {
        document.getElementById('card-inner').classList.add('is-flipped');
        document.getElementById('controls-show').classList.add('hidden');
        document.getElementById('controls-rate').classList.remove('hidden');
    },

    async handleAnswer(knewIt) {
        const clickSound = document.getElementById('click-sound');
        if (clickSound) clickSound.currentTime = 0; clickSound.play();

        const card = this.sessionCards[this.currentCardIndex];
        const key = card.word + card.translation;

        if (!this.isPracticeMode) {
            let p = this.userProgress[key] || { box: 1 };
            if (!knewIt) p.box = 1;
            else p.box = Math.min(6, p.box + 1);

            const days = REPETITION_INTERVALS[p.box];
            p.nextReview = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
            this.userProgress[key] = p;
            await this.saveProgress();
            this.renderDueToday(); // ← мгновенное обновление!
        }

        this.currentCardIndex++;
        this.showNextCard();
    },

    showHint() {
        if (!this.currentHintImage) return;
        document.getElementById('hint-image').src = this.currentHintImage;
        this.openModal('hint-modal');
    },

    renderBackButton(target) {
        document.getElementById('back-button-container').innerHTML = 
            `<button onclick="window.App.${target}" class="text-blue-600 font-bold mb-4">← Назад</button>`;
    },

    showScreen(id) {
        document.querySelectorAll('#app > div').forEach(d => d.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
    },

    openModal(id) {
        const modal = document.getElementById(id);
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('is-open'), 10);
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        modal.classList.remove('is-open');
        setTimeout(() => modal.classList.add('hidden'), 300);
    },

    showLockedModal() { this.openModal('locked-modal'); }
};

window.addEventListener('load', () => window.App.init());