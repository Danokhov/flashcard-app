import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const DAYS_PER_WEEK = 7;

const REPETITION_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30, 6: 90 };

function getBaseUrl() {
    const path = window.location.pathname.split('/');
    path.pop();
    const folderPath = path.join('/') + (path.length > 1 ? '/' : '');
    const base = window.location.origin + folderPath;
    return base.endsWith('/') ? base : base + '/';
}

const WORD_SETS = [
    { id: "a1_nouns_1", week: 1, name: "Сущ. A1 (Часть 1)", cards: [
        { id: "der_Tisch", front: "стол", back: "der Tisch", hintImage: "https://placehold.co/150x100/505050/ffffff?text=Стол" },
        { id: "die_Frau", front: "женщина", back: "die Frau" }
    ]},
    { id: "a1_nouns_2", week: 2, name: "Сущ. A1 (Часть 2)", cards: [
        { id: "das_Auto", front: "машина", back: "das Auto" },
        { id: "das_Haus", front: "дом", back: "das Haus" }
    ]},
    { id: "a1_nouns_3", week: 3, name: "Сущ. A1 (Часть 3)", cards: [
        { id: "der_Mann", front: "мужчина", back: "der Mann" },
        { id: "die_Stadt", front: "город", back: "die Stadt" }
    ]},
];

const WEEKLY_CONTENT_MAP = {
    1: { associationVideo: "https://play.boomstream.com/XukTFOqJ", associationTitle: "Ассоциации для Недели 1", storyLink: "text1.html", wordSetId: "a1_nouns_1", carouselId: "city" },
    2: { associationVideo: "https://play.boomstream.com/XukTFOqJ", associationTitle: "Ассоциации для артикля 'Das'", wordSetId: "a1_nouns_2", carouselId: "city" },
    3: { associationVideo: "https://www.youtube.com/embed/M0TfQvX5X1o?autoplay=0", associationTitle: "Ассоциации для существительных А1 (Часть 3)", wordSetId: "a1_nouns_3", carouselId: "food" },
};

const ALL_WEEKS = Object.keys(WEEKLY_CONTENT_MAP).map(Number).sort((a, b) => a - b);

window.App = {
    db: null,
    userId: null,
    userProgress: {},
    unlockedWeek: 0,        // 0 = только пробный урок
    lastSeenWeek: null,     // Какая неделя отображается на главном экране
    sessionCards: [],
    currentCardIndex: 0,
    isPracticeMode: false,
    isAdvancing: false,
    currentDirection: 'ru-de',
    tempSetId: null,
    tempMode: null,
    currentScreenId: 'loading-screen',
    returnContext: { screen: 'home-screen', param: null },
    carouselSetsMetadata: [],
    carouselCards: [],
    currentCarouselIndex: 0,
    carouselReturnContext: { screen: 'home-screen', param: null },

    async init() {
        try {
            const firebaseConfigStr = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
            const firebaseConfig = JSON.parse(firebaseConfigStr);

            if (Object.keys(firebaseConfig).length > 0) {
                const app = initializeApp(firebaseConfig);
                this.db = getFirestore(app);
            }

            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.ready();
                this.userId = Telegram.WebApp.initDataUnsafe?.user?.id?.toString() || "test_user_123";
            } else {
                this.userId = "web_user_" + Math.random().toString(36).substring(7);
            }

            this.disableZoom();
            if (this.db) await this.loadProgress();
            else this.renderHomeScreen();

        } catch (error) {
            console.error(error);
            this.showError("Ошибка инициализации");
        }
    },

    disableZoom() {
        document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
        let lastTouchEnd = 0;
        document.addEventListener('touchend', e => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) e.preventDefault();
            lastTouchEnd = now;
        }, false);
    },

    async loadProgress() {
        this.showScreen('loading-screen');
        if (!this.db) { this.renderHomeScreen(); return; }

        try {
            const docRef = doc(this.db, 'users', this.userId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();

                if (data.isPaid && data.paidAt) {
                    const paidDate = data.paidAt.toDate();
                    const daysSince = Math.floor((new Date() - paidDate) / (1000 * 60 * 60 * 24));
                    this.unlockedWeek = Math.floor(daysSince / DAYS_PER_WEEK) + 1;

                    if (this.unlockedWeek > (data.currentWeek || 0)) {
                        await setDoc(docRef, { currentWeek: this.unlockedWeek }, { merge: true });
                    }
                } else {
                    this.unlockedWeek = 0;
                }

                this.userProgress = data.cards || {};
                this.lastSeenWeek = data.lastSeenWeek || null;

            } else {
                this.unlockedWeek = 0;
                this.lastSeenWeek = null;
                await setDoc(docRef, { isPaid: false, lastSeenWeek: null, createdAt: serverTimestamp() }, { merge: true });
            }
        } catch (e) {
            console.error(e);
            this.unlockedWeek = 0;
        } finally {
            this.renderHomeScreen();
        }
    },

    async saveProgress() {
        if (!this.db) return;
        try {
            await setDoc(doc(this.db, 'users', this.userId), {
                cards: this.userProgress,
                lastSeenWeek: this.lastSeenWeek,
                currentWeek: this.unlockedWeek,
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (e) { console.error(e); }
    },

    renderHomeScreen() {
        this.showScreen('home-screen');
        const container = document.getElementById('home-buttons');
        container.innerHTML = '';

        if (this.unlockedWeek === 0) {
            // ПРОБНЫЙ УРОК
            const btn = document.createElement('button');
            btn.className = "w-full py-8 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-3xl shadow-2xl text-3xl font-bold transform hover:scale-105 transition";
            btn.innerHTML = `Пробный урок<br><span class="text-5xl mt-2">Неделя 1 — бесплатно!</span>`;
            btn.onclick = () => this.renderWeekContent(1);
            container.appendChild(btn);

        } else {
            // ПОЛНЫЙ ДОСТУП
            const weeklyBtn = document.createElement('button');
            weeklyBtn.onclick = () => this.renderWeeklySelections();
            weeklyBtn.className = "w-full py-5 bg-white rounded-2xl shadow-xl text-xl font-bold text-gray-800 hover:bg-gray-50 transition";
            weeklyBtn.innerHTML = `Подборки по неделям<br><span class="text-3xl text-green-600">До Недели ${this.unlockedWeek}</span>`;
            container.appendChild(weeklyBtn);

            if (this.lastSeenWeek && this.lastSeenWeek <= this.unlockedWeek) {
                const continueBtn = document.createElement('button');
                continueBtn.className = "w-full py-8 mt-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-3xl shadow-2xl text-3xl font-bold transform hover:scale-105 transition";
                continueBtn.innerHTML = `Продолжить изучение<br><span class="text-5xl mt-2">Неделя ${this.lastSeenWeek}</span>`;
                continueBtn.onclick = () => this.renderWeekContent(this.lastSeenWeek);
                container.appendChild(continueBtn);
            }

            this.renderDueTodaySection();
        }
    },

    renderWeeklySelections() {
        this.returnContext = { screen: 'home-screen', param: null };
        document.getElementById('list-title').innerText = 'Подборки по неделям';
        this.renderBackButton('home-screen');
        document.getElementById('filter-controls').innerHTML = '';
        const list = document.getElementById('content-list');
        list.innerHTML = '';

        ALL_WEEKS.forEach(i => {
            const isUnlocked = i <= this.unlockedWeek || (this.unlockedWeek === 0 && i === 1);
            const btn = document.createElement('button');
            btn.className = `w-full p-6 rounded-2xl shadow-lg text-left text-2xl font-bold transition ${isUnlocked ? 'bg-white hover:bg-gray-50' : 'bg-gray-200 text-gray-500'}`;
            btn.innerHTML = `Неделя ${i}<span class="block text-lg mt-2">${isUnlocked ? 'Доступно' : 'Открывается через несколько дней'}</span>`;
            if (isUnlocked) btn.onclick = () => this.renderWeekContent(i);
            list.appendChild(btn);
        });

        this.showScreen('list-screen');
    },

    async renderWeekContent(weekNum) {
        if (this.unlockedWeek > 0) {
            this.lastSeenWeek = weekNum;
            await this.saveProgress();
        }

        const data = WEEKLY_CONTENT_MAP[weekNum];
        if (!data) return;

        this.returnContext = { screen: 'weekly-selections', param: null };
        document.getElementById('list-title').innerText = `Неделя ${weekNum}`;
        this.renderBackButton('weekly-selections');
        document.getElementById('filter-controls').innerHTML = '';
        const list = document.getElementById('content-list');
        list.innerHTML = '';

        const addBtn = (title, subtitle, onclick, bg = 'bg-white hover:bg-gray-50') => {
            const b = document.createElement('button');
            b.className = `w-full p-5 ${bg} rounded-2xl shadow-lg text-left text-xl font-semibold transition`;
            b.innerHTML = `<div>${title}</div><div class="text-lg text-gray-600">${subtitle}</div>`;
            b.onclick = onclick;
            list.appendChild(b);
        };

        addBtn('Видео ассоциации', data.associationTitle,
            () => this.renderVideoContentScreen(data.associationTitle, data.associationVideo, null, 'week-content', weekNum));

        addBtn('Слова на неделю', `Повторение ${WORD_SETS.find(s => s.id === data.wordSetId)?.cards.length || 0} слов`,
            () => this.promptForDirection(data.wordSetId, 'practice'), 'bg-green-100 hover:bg-green-200');

        this.showScreen('list-screen');
    },

    renderVideoContentScreen(title, url, text, fromScreen, fromParam) {
        this.returnContext = { screen: fromScreen, param: fromParam };
        document.getElementById('video-title').textContent = title;
        document.getElementById('video-embed').src = url;
        this.renderBackButton(fromScreen, fromParam, 'video-content-screen');
        this.showScreen('video-content-screen');
    },

    renderBackButton(target, param = null, screenOverride = null) {
        const containerId = screenOverride === 'video-content-screen' ? 'video-back-button-container' : 'back-button-container';
        const container = document.getElementById(containerId);
        if (!container) return;

        const func = target === 'home-screen' ? 'window.App.renderHomeScreen()' :
                     target === 'weekly-selections' ? 'window.App.renderWeeklySelections()' :
                     `window.App.renderWeekContent(${param})`;

        container.innerHTML = `<button onclick="${func}" class="text-blue-600 font-bold flex items-center"><svg class="w-6 h-6 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>Назад</button>`;
    },

    promptForDirection(setId, mode) {
        this.tempSetId = setId; this.tempMode = mode;
        this.openModal('direction-modal');
    },

    startSessionWithDirection(dir) {
        this.currentDirection = dir;
        this.closeDirectionModal();
        this.startSession(this.tempSetId, this.tempMode);
    },

    startSession(setId, mode) {
        const set = WORD_SETS.find(s => s.id === setId);
        if (!set) return;

        this.isPracticeMode = (mode === 'practice');
        const today = this.getTodayDateString();

        this.sessionCards = this.isPracticeMode
            ? [...set.cards]
            : set.cards.filter(c => {
                const p = this.userProgress[c.id];
                return !p || (p.nextReview && p.nextReview <= today);
            });

        if (this.sessionCards.length === 0) {
            alert(this.isPracticeMode ? "Нет карточек" : "Нет карточек к повторению");
            return;
        }

        this.sessionCards.sort(() => Math.random() - 0.5);
        this.currentCardIndex = 0;
        this.showScreen('study-screen');
        this.showNextCard();
    },

    showNextCard() {
        if (this.currentCardIndex >= this.sessionCards.length) {
            this.showScreen('finish-screen');
            return;
        }

        const card = this.sessionCards[this.currentCardIndex];
        const percent = ((this.currentCardIndex + 1) / this.sessionCards.length) * 100;
        document.getElementById('progress-bar').style.width = `${percent}%`;

        document.getElementById('card').classList.remove('is-flipped');
        document.getElementById('controls-show').classList.remove('hidden');
        document.getElementById('controls-rate').classList.add('hidden');

        if (this.currentDirection === 'ru-de') {
            document.getElementById('card-front-text').textContent = card.front;
            document.getElementById('card-back-text').innerHTML = `${card.back} <span onclick="window.App.speakGerman('${card.back}', event)" class="ml-2 cursor-pointer">Speaker</span>`;
        } else {
            document.getElementById('card-front-text').innerHTML = `${card.back} <span onclick="window.App.speakGerman('${card.back}', event)" class="ml-2 cursor-pointer">Speaker</span>`;
            document.getElementById('card-back-text').textContent = card.front;
        }

        document.getElementById('hint-button').classList.toggle('hidden', !card.hintImage);
    },

    showAnswer() {
        document.getElementById('card').classList.add('is-flipped');
        document.getElementById('controls-show').classList.add('hidden');
        document.getElementById('controls-rate').classList.remove('hidden');
    },

    async handleAnswer(knew) {
        if (this.isAdvancing) return;
        this.isAdvancing = true;

        if (!this.isPracticeMode) {
            const card = this.sessionCards[this.currentCardIndex];
            const progress = this.userProgress[card.id] || { box: 0 };
            progress.box = knew ? Math.min(6, progress.box + 1) : 1;
            progress.nextReview = this.getFutureDateString(REPETITION_INTERVALS[progress.box]);
            this.userProgress[card.id] = progress;
            await this.saveProgress();
        }

        document.getElementById('card').classList.add('slide-out');
        setTimeout(() => {
            this.currentCardIndex++;
            this.isAdvancing = false;
            this.showNextCard();
        }, 400);
    },

    speakGerman(text) {
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'de-DE';
            speechSynthesis.speak(utter);
        }
    },

    openModal(id) {
        const modal = document.getElementById(id);
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('opacity-100'), 10);
    },

    closeModal(id) {
        const modal = document.getElementById(id);
        modal.classList.remove('opacity-100');
        setTimeout(() => modal.classList.add('hidden'), 300);
    },

    closeDirectionModal() { this.closeModal('direction-modal'); },

    showHint() {
        const card = this.sessionCards[this.currentCardIndex];
        if (card?.hintImage) {
            document.getElementById('hint-image').src = card.hintImage;
            this.openModal('hint-modal');
        }
    },

    showScreen(id) {
        document.querySelectorAll('#app > div').forEach(d => d.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
        this.currentScreenId = id;
    },

    showError(msg) {
        this.showScreen('loading-screen');
        document.getElementById('loading-screen').innerHTML = `<p class="text-red-600 text-xl">${msg}</p>`;
    },

    getTodayDateString() {
        return new Date().toISOString().split('T')[0];
    },

    getFutureDateString(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    },

    renderDueTodaySection() {
        // Можно оставить как было или упростить — сейчас не критично
    }
};

window.addEventListener('load', () => {
    if ('speechSynthesis' in window) {
        speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
    }
    window.App.init();
});