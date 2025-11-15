import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const DAYS_PER_WEEK = 7;
const REPETITION_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30, 6: 90 };

const WORD_SETS = [
    { id: "a1_nouns_1", week: 1, name: "Сущ. A1 (Часть 1)", cards: [ /* твои карточки */ ] },
    { id: "a1_nouns_2", week: 2, name: "Сущ. A1 (Часть 2)", cards: [ /* ... */ ] },
    { id: "a1_nouns_3", week: 3, name: "Сущ. A1 (Часть 3)", cards: [ /* ... */ ] },
    // добавляй остальные недели
];

const WEEKLY_CONTENT_MAP = {
    1: { title: "Неделя 1 — Основы",      video: "https://play.boomstream.com/XukTFOqJ", desc: "20 слов • Артикли • Видео-ассоциации • История", wordSetId: "a1_nouns_1" },
    2: { title: "Неделя 2 — Das и Die",   video: "https://play.boomstream.com/XXXXX", desc: "25 слов • Средний и женский род • Диалоги", wordSetId: "a1_nouns_2" },
    3: { title: "Неделя 3 — Der",         video: "https://youtube.com/...", desc: "30 слов • Мужской род • История про город", wordSetId: "a1_nouns_3" },
    4: { title: "Неделя 4 — Плюс глаголы", video: "", desc: "Глаголы sein/haben • 40 слов • Практика", wordSetId: "week4_set" },
    // добавляй сколько угодно
};

const ALL_WEEKS = Object.keys(WEEKLY_CONTENT_MAP).map(Number).sort((a, b) => a - b);

window.App = {
    db: null,
    userId: null,
    userProgress: {},
    unlockedWeek: 0,           // 0 = только проба Недели 1, >0 = оплачено
    hasStartedTrial: false,    // начал ли Неделю 1
    lastSeenWeek: null,

    async init() {
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        if (Object.keys(firebaseConfig).length) {
            const app = initializeApp(firebaseConfig);
            this.db = getFirestore(app);
        }

        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            this.userId = Telegram.WebApp.initDataUnsafe?.user?.id?.toString() || "test";
        } else {
            this.userId = "web_" + Math.random().toString(36).substr(2, 9);
        }

        if (this.db) await this.loadProgress();
        else this.renderHomeScreen();
    },

    async loadProgress() {
        this.showScreen('loading-screen');
        try {
            const ref = doc(this.db, 'users', this.userId);
            const snap = await getDoc(ref);

            if (snap.exists()) {
                const d = snap.data();
                if (d.isPaid && d.paidAt) {
                    const days = Math.floor((Date.now() - d.paidAt.toDate()) / 86400000);
                    this.unlockedWeek = Math.floor(days / DAYS_PER_WEEK) + 1;
                } else {
                    this.unlockedWeek = 0;
                }
                this.hasStartedTrial = d.hasStartedTrial || false;
                this.lastSeenWeek = d.lastSeenWeek || null;
                this.userProgress = d.cards || {};
            } else {
                await setDoc(ref, { isPaid: false, hasStartedTrial: false }, { merge: true });
                this.unlockedWeek = 0;
            }
        } catch (e) { console.error(e); }
        this.renderHomeScreen();
    },

    async saveProgress() {
        if (!this.db) return;
        await setDoc(doc(this.db, 'users', this.userId), {
            hasStartedTrial: this.hasStartedTrial,
            lastSeenWeek: this.lastSeenWeek,
            cards: this.userProgress,
            updatedAt: serverTimestamp()
        }, { merge: true });
    },

    // ==================== ГЛАВНОЕ МЕНЮ ====================
    renderHomeScreen() {
        this.showScreen('home-screen');
        const container = document.getElementById('home-buttons');
        container.innerHTML = '';

        // 1. Пробный урок (всегда виден, пока не начал Неделю 1)
        if (!this.hasStartedTrial) {
            const trial = document.createElement('button');
            trial.onclick = () => this.renderWeeklySelections();
            trial.className = "w-full py-6 mb-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-3xl shadow-2xl text-2xl font-bold";
            trial.innerHTML = `Пробный урок<br><span class="text-lg">Неделя 1 — бесплатно!</span>`;
            container.appendChild(trial);
        } else if (this.lastSeenWeek === 1) {
            const cont = document.createElement('button');
            cont.onclick = () => this.renderWeekContent(1);
            cont.className = "w-full py-8 mb-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-3xl shadow-2xl text-3xl font-bold";
            cont.innerHTML = `Продолжить<br><span class="text-5xl">Неделя 1</span>`;
            container.appendChild(cont);
        }

        // 2. Подборки по неделям
        const weekly = document.createElement('button');
        weekly.onclick = () => this.renderWeeklySelections();
        weekly.className = "w-full py-5 bg-white rounded-2xl shadow-xl text-xl font-bold text-gray-800 hover:bg-gray-50 transition";
        weekly.textContent = "Подборки по неделям";
        container.appendChild(weekly);

        // 3. Все наборы слов
        const allSets = document.createElement('button');
        allSets.onclick = () => this.renderAllSetsScreen();
        allSets.className = "w-full py-5 mt-3 bg-white rounded-2xl shadow-xl text-xl font-bold text-gray-800 hover:bg-gray-50 transition";
        allSets.textContent = "Все наборы слов";
        container.appendChild(allSets);
    },

    // ==================== СПИСОК НЕДЕЛЬ ====================
    renderWeeklySelections() {
        this.returnContext = { screen: 'home-screen' };
        document.getElementById('list-title').textContent = 'Подборки по неделям';
        this.renderBackButton('home-screen');
        document.getElementById('content-list').innerHTML = '';

        ALL_WEEKS.forEach(w => {
            const weekData = WEEKLY_CONTENT_MAP[w];
            if (!weekData) return;

            const isTrialWeek = w === 1;
            const canStudy = isTrialWeek || (this.unlockedWeek > 0 && w <= this.unlockedWeek);

            const card = document.createElement('div');
            card.className = "p-6 bg-white rounded-3xl shadow-xl mb-6";

            card.innerHTML = `
                <h3 class="text-2xl font-bold mb-3">${weekData.title}</h3>
                <p class="text-gray-600 mb-6">${weekData.desc}</p>
                <div class="grid grid-cols-2 gap-4">
                    <button onclick="window.App.showWeekInfo(${w})"
                            class="py-4 bg-gray-200 rounded-2xl font-bold text-gray-800 hover:bg-gray-300 transition">
                        Подробнее
                    </button>
                    <button ${canStudy ? '' : 'disabled'}
                            onclick="${canStudy ? (isTrialWeek ? 'window.App.startTrialWeek(' + w + ')' : 'window.App.renderWeekContent(' + w + ')') : ''}"
                            class="${canStudy ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg' : 'bg-gray-400 text-gray-600 cursor-not-allowed'} py-4 rounded-2xl font-bold transition">
                        ${canStudy ? 'Учить' : 'Заблокировано'}
                    </button>
                </div>
            `;
            document.getElementById('content-list').appendChild(card);
        });

        this.showScreen('list-screen');
    },

    // Начать пробную Неделю 1
    async startTrialWeek(week) {
        this.hasStartedTrial = true;
        this.lastSeenWeek = week;
        await this.saveProgress();
        this.renderWeekContent(week);
    },

    // Модальное окно "Подробнее"
    showWeekInfo(week) {
        const data = WEEKLY_CONTENT_MAP[week];
        const message = week === 1
            ? `Пробный урок — Неделя 1\n\n${data.desc}\n\nДоступен навсегда и полностью бесплатно!`
            : `Неделя ${week}\n\n${data.desc}\n\nОткроется после оплаты + каждые 7 дней новая неделя`;

        alert(message);
    },

    // Открытие контента недели (видео, слова и т.д.)
    renderWeekContent(weekNum) {
        this.lastSeenWeek = weekNum;
        this.saveProgress();

        const data = WEEKLY_CONTENT_MAP[weekNum];
        document.getElementById('list-title').textContent = data.title;
        this.renderBackButton('weekly-selections');
        const list = document.getElementById('content-list');
        list.innerHTML = '';

        // Видео-ассоциации
        if (data.video) {
            const btn = document.createElement('button');
            btn.className = "w-full p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-3xl shadow-xl text-xl font-bold mb-4";
            btn.textContent = "Видео-ассоциации";
            btn.onclick = () => this.renderVideoContentScreen(data.title, data.video);
            list.appendChild(btn);
        }

        // Слова недели
        const studyBtn = document.createElement('button');
        studyBtn.className = "w-full p-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-3xl shadow-xl text-xl font-bold";
        studyBtn.textContent = "Изучать слова";
        studyBtn.onclick = () => this.promptForDirection(data.wordSetId, 'practice');
        list.appendChild(studyBtn);

        this.showScreen('list-screen');
    },

    renderVideoContentScreen(title, url) {
        document.getElementById('video-title').textContent = title;
        document.getElementById('video-embed').src = url;
        this.renderBackButton('weekly-selections', null, 'video-content-screen');
        this.showScreen('video-content-screen');
    },

    renderBackButton(target, param = null, override = null) {
        const id = override === 'video-content-screen' ? 'video-back-button-container' : 'back-button-container';
        const container = document.getElementById(id);
        if (!container) return;
        const func = target === 'home-screen' ? 'window.App.renderHomeScreen()' :
                     target === 'weekly-selections' ? 'window.App.renderWeeklySelections()' :
                     `window.App.renderWeekContent(${param})`;
        container.innerHTML = `<button onclick="${func}" class="text-blue-600 font-bold flex items-center">Назад</button>`;
    },

    // Остальные функции (study-screen, модалки, повторения и т.д.) — оставь из предыдущей версии
    // Они полностью совместимы

    showScreen(id) {
        document.querySelectorAll('#app > div[id$="-screen"]').forEach(el => el.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
    }
};

window.addEventListener('load', () => window.App.init());