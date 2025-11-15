import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const REPETITION_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30, 6: 90 };

window.App = {
    db: null, userId: null, userProgress: {}, carouselSets: [], hasCompletedTrial: false,

    async init() {
        const cfg = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        if (Object.keys(cfg).length) { const app = initializeApp(cfg); this.db = getFirestore(app); }

        this.userId = Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || "test_" + Date.now();
        await this.loadCarouselSets();
        if (this.db) await this.loadProgress();
        this.renderHomeScreen();
    },

    async loadCarouselSets() {
        try {
            const res = await fetch('carousel_sets.json');
            this.carouselSets = await res.json();
        } catch (e) { console.error("Не удалось загрузить carousel_sets.json", e); }
    },

    async loadProgress() {
        try {
            const ref = doc(this.db, 'users', this.userId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const d = snap.data();
                this.hasCompletedTrial = d.hasCompletedTrial || false;
                this.userProgress = d.cards || {};
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

    renderHomeScreen() {
        this.showScreen('home-screen');
        const block = document.getElementById('main-content-block');
        block.innerHTML = '';

        if (!this.hasCompletedTrial) {
            const btn = document.createElement('button');
            btn.onclick = () => window.location.href = 'trial.html';
            btn.className = "w-full py-8 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-3xl shadow-2xl text-3xl font-bold";
            btn.innerHTML = `Пробный урок<br><span class="text-xl opacity-90">Бесплатно!</span>`;
            block.appendChild(btn);
        } else if (!this.hasCompletedTrial) {
            const btn = document.createElement('button');
            btn.onclick = () => Telegram.WebApp.openLink('https://t.me/твой_бот_оплаты');
            btn.className = "w-full py-8 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-3xl shadow-2xl text-3xl font-bold";
            btn.innerHTML = `Открыть весь курс<br><span class="text-xl">30+ недель</span>`;
            block.appendChild(btn);
        }
        this.renderDueToday();
    },

    renderDueToday() {
        const today = new Date().toISOString().split('T')[0];
        const due = [];

        this.carouselSets.forEach(set => {
            if (!set.cards) return;
            const dueCount = set.cards.filter(c => {
                const p = this.userProgress[c.id];
                return p && p.nextReview && p.nextReview <= today;
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
            div.className = "bg-white rounded-xl shadow p-4 flex justify-between items-center";
            div.innerHTML = `<span class="font-semibold">${item.set.title}</span><span class="text-red-600">${item.dueCount} к повторению</span>`;
            div.onclick = () => this.startSession(item.set.id, 'repeat');
            list.appendChild(div);
        });
    },

    async renderAllSetsScreen() {
        document.getElementById('list-title').textContent = 'Все наборы слов';
        this.renderBackButton('home-screen');
        const list = document.getElementById('content-list');
        list.innerHTML = '';

        for (const set of this.carouselSets) {
            if (!set.cards) {
                try {
                    const res = await fetch(set.filepath);
                    set.cards = await res.json();
                } catch (e) { console.error(e); continue; }
            }

            const div = document.createElement('div');
            div.className = "bg-white rounded-2xl shadow-lg p-6 flex justify-between items-center";
            div.innerHTML = `
                <div>
                    <div class="font-bold text-xl">${set.title}</div>
                    <div class="text-gray-600">${set.wordCount} слов</div>
                </div>
                <button onclick="window.App.startSession('${set.id}', 'practice')" 
                        class="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold">
                    Учить
                </button>
            `;
            list.appendChild(div);
        }
        this.showScreen('list-screen');
    },

    async startSession(setId, mode) {
        const set = this.carouselSets.find(s => s.id === setId);
        if (!set.cards) {
            const res = await fetch(set.filepath);
            set.cards = await res.json();
        }

        let sessionCards = mode === 'practice' ? [...set.cards] : set.cards.filter(c => {
            const p = this.userProgress[c.id];
            const today = new Date().toISOString().split('T')[0];
            return p && p.nextReview && p.nextReview <= today;
        });

        if (sessionCards.length === 0) {
            alert(mode === 'practice' ? 'Нет слов в наборе' : 'Нет слов к повторению сегодня');
            return;
        }

        this.sessionCards = sessionCards.map(c => ({...c}));
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
        document.getElementById('card').classList.remove('is-flipped');
        document.getElementById('controls-show').classList.remove('hidden');
        document.getElementById('controls-rate').classList.add('hidden');
        document.getElementById('card-front').textContent = card.front;
        document.getElementById('card-back').textContent = card.back;
    },

    showAnswer() {
        document.getElementById('card').classList.add('is-flipped');
        document.getElementById('controls-show').classList.add('hidden');
        document.getElementById('controls-rate').classList.remove('hidden');
    },

    async handleAnswer(knewIt) {
        if (!this.isPracticeMode) {
            const card = this.sessionCards[this.currentCardIndex];
            let p = this.userProgress[card.id] || { box: 0 };
            p.box = knewIt ? Math.min(6, p.box + 1) : 1;
            const days = REPETITION_INTERVALS[p.box];
            p.nextReview = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
            this.userProgress[card.id] = p;
            await this.saveProgress();
        }
        this.currentCardIndex++;
        this.showNextCard();
    },

    renderBackButton(target) {
        document.getElementById('back-button-container').innerHTML = 
            `<button onclick="window.App.${target === 'home-screen' ? 'renderHomeScreen()' : 'renderAllSetsScreen()'}" 
                     class="text-blue-600 font-bold mb-4">← Назад</button>`;
    },

    showScreen(id) {
        document.querySelectorAll('#app > div').forEach(d => d.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
    },

    openModal(id) { document.getElementById(id).classList.remove('hidden'); },
    closeModal(id) { document.getElementById(id).classList.add('hidden'); }
};

window.addEventListener('load', () => window.App.init());