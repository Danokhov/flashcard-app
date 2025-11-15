<script type="module">
        // Импортируем необходимые модули Firebase (v9+)
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
        import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

        // ==========================================================
        // 1. КОНФИГУРАЦИЯ И ДАННЫЕ (Conceptual Data Module)
        // ==========================================================
        
        const REPETITION_INTERVALS = {
            1: 1,  // 1 день
            2: 3,  // 3 дня
            3: 7,  // 7 дней
            4: 14, // 2 недели
            5: 30, // 1 месяц
            6: 90  // 3 месяца
        };
        
        /**
         * Утилита для получения базового URL (корневой папки приложения)
         */
        function getBaseUrl() {
            const path = window.location.pathname.split('/');
            // Удаляем имя файла (index.html)
            path.pop(); 
            // Получаем путь к папке (например, '/subfolder/')
            const folderPath = path.join('/') + (path.length > 1 ? '/' : ''); 
            
            // Собираем полный базовый URL: 'https://[your-site-name].netlify.app/subfolder/'
            const base = window.location.origin + folderPath;
            
            // Убираем конечный слэш, если это корень, или оставляем, если есть путь
            return base.endsWith('/') ? base : base + '/';
        }

        /**
         * Данные наборов слов
         */
        const WORD_SETS = [
            // Неделя 1
            { id: "a1_nouns_1", week: 1, name: "Сущ. A1 (Часть 1)", cards: [
                { id: "der_Tisch", front: "стол", back: "der Tisch", hintImage: "https://placehold.co/150x100/505050/ffffff?text=Стол" },
                { id: "die_Frau", front: "женщина", back: "die Frau" }
            ]},
            // Неделя 2
            { id: "a1_nouns_2", week: 2, name: "Сущ. A1 (Часть 2)", cards: [
                { id: "das_Auto", front: "машина", back: "das Auto" },
                { id: "das_Haus", front: "дом", back: "das Haus" }
            ]},
            // Неделя 3 (Пока заблокирована для новых пользователей)
            { id: "a1_nouns_3", week: 3, name: "Сущ. A1 (Часть 3)", cards: [
                { id: "der_Mann", front: "мужчина", back: "der Mann" },
                { id: "die_Stadt", front: "город", back: "die Stadt" }
            ]},
        ];

        /**
         * Карта контента для каждой недели. 
         */
        const WEEKLY_CONTENT_MAP = {
            1: {
                associationVideo: "https://play.boomstream.com/XukTFOqJ",
                associationTitle: "Ассоциации для Недели 1",
                storyLink: "text1.html", // Относительный путь для загрузки внутри SPA
                wordSetId: "a1_nouns_1",
                dialoguesLink: "https://your-domain.com/dialogs/week1",
                carouselId: "city" // Добавлена связь с каруселью "animals" для недели 1
            },
            2: {
                associationVideo: "https://play.boomstream.com/XukTFOqJ",
                associationTitle: "Ассоциации для артикля 'Das' (средний род)",
                storyLink: "https://your-domain.com/story/week2",
                wordSetId: "a1_nouns_2",
                dialoguesLink: "https://your-domain.com/dialogs/week2",
                carouselId: "city" // Связь с каруселью "city" для недели 2 (для примера)
            },
            3: {
                associationVideo: "https://www.youtube.com/embed/M0TfQvX5X1o?autoplay=0&controls=1&showinfo=0&rel=0",
                associationTitle: "Ассоциации для существительных А1 (Часть 3)",
                storyLink: "https://your-domain.com/story/week3",
                wordSetId: "a1_nouns_3",
                dialoguesLink: "https://your-domain.com/dialogs/week3",
                carouselId: "food" // Связь с каруселью "food" для недели 3 (для примера)
            },
        };

        // Вспомогательные массивы для фильтров
        const ALL_WEEKS = Object.keys(WEEKLY_CONTENT_MAP).map(Number).sort((a, b) => a - b);


        // ==========================================================
        // 2. ЛОГИКА ПРИЛОЖЕНИЯ (Conceptual App Module)
        // ==========================================================

        window.App = {
            db: null,
            userId: null,
            userProgress: {}, 
            unlockedWeek: 1, 
            sessionCards: [], 
            currentCardIndex: 0,
            isPracticeMode: false,
            isAdvancing: false,
            currentDirection: 'ru-de', 
            tempSetId: null, 
            tempMode: null,
            currentScreenId: 'loading-screen', 
            
            // Состояние фильтров (только для "Все наборы слов")
            currentWeekFilter: 'All', 
            currentThemeFilter: 'All', 
            
            // Текущий контекст для кнопки "Назад"
            returnContext: { screen: 'home-screen', param: null },

            // Данные карусели
            carouselSetsMetadata: [],
            carouselCards: [],
            currentCarouselIndex: 0,
            carouselReturnContext: { screen: 'home-screen', param: null },


            async init() {
                try {
                    // Инициализация Firebase (обязательная часть для Canvas)
                    const firebaseConfigStr = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
                    const firebaseConfig = JSON.parse(firebaseConfigStr);

                    if (Object.keys(firebaseConfig).length > 0) {
                        const app = initializeApp(firebaseConfig);
                        this.db = getFirestore(app);
                    } else {
                         console.warn("Firebase configuration not found. Running in local mode.");
                    }
                    
                    // Идентификация пользователя (Telegram или Web)
                    if (window.Telegram && window.Telegram.WebApp) {
                         window.Telegram.WebApp.ready();
                         this.userId = Telegram.WebApp.initDataUnsafe?.user?.id?.toString() || "test_user_123";
                    } else {
                         this.userId = "web_user_" + Math.random().toString(36).substring(7);
                    }

                    if (this.db) {
                        await this.loadProgress();
                    } else {
                        this.renderHomeScreen();
                    }
                    
                    // Добавляем защиту от зумирования
                    this.disableZoom();

                } catch (error) {
                    this.showError(`Ошибка инициализации: ${error.message}`);
                    console.error(error);
                }
            },
            
            /**
             * Отключает масштабирование (pinch-to-zoom) на мобильных устройствах.
             */
            disableZoom() {
                document.addEventListener('touchstart', (event) => {
                    // Если два пальца и больше, предотвращаем дефолтное поведение (зум)
                    if (event.touches.length > 1) {
                        event.preventDefault();
                    }
                }, { passive: false });

                // Также предотвращаем двойной тап
                let lastTouchEnd = 0;
                document.addEventListener('touchend', function (event) {
                    const now = (new Date()).getTime();
                    if (now - lastTouchEnd <= 300) {
                        event.preventDefault();
                    }
                    lastTouchEnd = now;
                }, false);
            },


            async loadProgress() {
                this.showScreen('loading-screen');
                if (!this.db) return; 

                try {
                    // Используем doc(this.db, 'userProgress', this.userId) для личных данных
                    const docRef = doc(this.db, 'userProgress', this.userId); 
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        this.userProgress = data.cards || {};
                        this.unlockedWeek = data.unlockedWeek || 1; 
                    } else {
                        this.userProgress = {};
                        this.unlockedWeek = 1; 
                        await this.saveProgress(); 
                    }
                } catch (error) {
                    console.error("Error loading progress:", error);
                } finally {
                    this.renderHomeScreen();
                }
            },
            
            async saveProgress() {
                if (!this.db) return; 

                try {
                    const docRef = doc(this.db, 'userProgress', this.userId);
                    await setDoc(docRef, { 
                        cards: this.userProgress,
                        unlockedWeek: this.unlockedWeek 
                    }, { merge: true });
                    console.log('Прогресс сохранен в Firebase');
                } catch (error) {
                    console.error('Ошибка сохранения прогресса:', error);
                }
            },

            // ==================== РЕНДЕРИНГ ЭКРАНОВ ====================

            renderHomeScreen() {
                this.showScreen('home-screen');
                this.returnContext = { screen: 'home-screen', param: null };
                this.renderDueTodaySection();
            },

            renderDueTodaySection() {
                // (Логика отображения секции "К повторению сегодня" - не изменена)
                const section = document.getElementById('due-today-section');
                const list = document.getElementById('due-today-list');
                if (!section || !list) return;

                const today = this.getTodayDateString();
                let dueSetsCount = 0;

                list.innerHTML = '';

                WORD_SETS.forEach(set => {
                    if (set.week > this.unlockedWeek) return;

                    let dueCount = 0;
                    set.cards.forEach(card => {
                        const progress = this.userProgress[card.id];
                        if (!progress || (progress.nextReview && progress.nextReview <= today)) {
                            dueCount++;
                        }
                    });

                    if (dueCount > 0) {
                        dueSetsCount++;
                        const setEl = document.createElement('div');
                        setEl.className = "bg-white p-4 rounded-xl shadow-md border-l-4 border-orange-500 flex justify-between items-center transform transition hover:-translate-y-1";
                        setEl.innerHTML = `
                            <div>
                                <span class="font-bold text-gray-800">${set.name}</span>
                                <span class="text-sm text-orange-600 font-medium block">Доступно для повторения: ${dueCount}</span>
                            </div>
                            <button onclick="window.App.promptForDirection('${set.id}', 'review')"
                                    class="py-2 px-4 bg-orange-100 text-orange-700 font-bold rounded-xl hover:bg-orange-200 transition duration-150 flex items-center">
                                Начать
                                <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </button>
                        `;
                        list.appendChild(setEl);
                    }
                });

                if (dueSetsCount > 0) {
                    section.classList.remove('hidden');
                } else {
                    section.classList.add('hidden');
                }
            },

            renderWeeklySelections() {
                this.returnContext = { screen: 'home-screen', param: null };
                document.getElementById('list-title').innerText = '📅 Подборки по неделям';
                this.renderBackButton('home-screen');
                document.getElementById('filter-controls').innerHTML = '';

                const contentListDiv = document.getElementById('content-list');
                contentListDiv.innerHTML = '';
                
                ALL_WEEKS.forEach(i => {
                    const isUnlocked = i <= this.unlockedWeek;
                    const weekContent = WEEKLY_CONTENT_MAP[i];
                    
                    const button = document.createElement('button');
                    button.className = `w-full text-left p-4 rounded-xl shadow-md flex justify-between items-center transition duration-150 ${isUnlocked ? 'bg-white hover:bg-gray-50' : 'button-locked'}`;
                    
                    if (isUnlocked) {
                        button.onclick = () => this.renderWeekContent(i);
                    } else {
                         button.onclick = () => console.log(`Неделя ${i} пока закрыта.`);
                    }

                    button.innerHTML = `
                        <div>
                            <span class="font-semibold text-lg ${isUnlocked ? 'text-gray-800' : 'text-gray-500'}">Неделя ${i}</span>
                            <span class="block text-sm text-gray-500">${weekContent ? 'Доступно' : 'Скоро...'}</span>
                        </div>
                        ${!isUnlocked ? '<span>🔒</span>' : '<span>&rarr;</span>'}
                    `;
                    contentListDiv.appendChild(button);
                });
                
                this.showScreen('list-screen');
            },
            
            /**
             * Рендерит карточку меню для недели
             */
            renderMenuCard(container, title, subtitle, onClickAction, style = 'bg-white hover:bg-gray-50') {
                const button = document.createElement('button');
                button.className = `w-full text-left p-4 ${style} rounded-xl shadow-md flex justify-between items-center transition duration-150`;
                button.setAttribute('onclick', onClickAction);
                
                button.innerHTML = `
                    <div>
                        <span class="font-semibold text-lg text-gray-800">${title}</span>
                        <span class="block text-sm text-gray-500">${subtitle}</span>
                    </div>
                    <span>&rarr;</span>
                `;
                container.appendChild(button);
            },
            
            renderWeekContent(weekNum) {
                const weekData = WEEKLY_CONTENT_MAP[weekNum];
                if (!weekData) return;
                
                // Находим метаданные карусели для этой недели, если они уже загружены
                const carouselSet = this.carouselSetsMetadata.find(set => set.id === weekData.carouselId);
                
                this.returnContext = { screen: 'weekly-selections', param: null };
                document.getElementById('list-title').innerText = `Контент Недели ${weekNum}`;
                this.renderBackButton('weekly-selections'); 
                document.getElementById('filter-controls').innerHTML = '';

                const contentListDiv = document.getElementById('content-list');
                contentListDiv.innerHTML = '';
                
                // 1. Ассоциации на неделю (Видео)
                this.renderMenuCard(contentListDiv, 
                    `🧠 Видео ассоциации`, 
                    weekData.associationTitle,
                    `window.App.renderVideoContentScreen('${weekData.associationTitle.replace(/'/g, "\\'")}', '${weekData.associationVideo}', null, 'week-content', ${weekNum})`
                );
                
                // 2. Карусель ассоциаций (ПРЯМОЙ ПЕРЕХОД К ОДНОЙ КАРУСЕЛИ)
                if (carouselSet) {
                    this.renderMenuCard(contentListDiv, 
                        `🖼️ Карусель ассоциаций: ${carouselSet.title}`, 
                        `Визуальное изучение ${carouselSet.wordCount} слов`,
                        `window.App.startCarouselSession('${carouselSet.id}', '${carouselSet.title}', '${carouselSet.filepath}', 'week-content', ${weekNum})`,
                        'bg-purple-100 hover:bg-purple-200'
                    );
                } else {
                     this.renderMenuCard(contentListDiv, 
                        `🖼️ Карусель ассоциаций (Ошибка)`, 
                        `Набор не найден или не загружен.`,
                        `void(0)`,
                        'button-locked'
                    );
                }

                // 3. История недели (ВНУТРЕННЯЯ ЗАГРУЗКА text1.html)
                this.renderMenuCard(contentListDiv, 
                    `📖 История недели`, 
                    `Видео + квиз`,
                    `window.App.renderStoryScreen('📖 История недели ${weekNum}', '${getBaseUrl() + weekData.storyLink}', 'week-content', ${weekNum})` 
                );

                // 4. Слова на неделю (Сразу модальное окно повторения)
                this.renderMenuCard(contentListDiv, 
                    `📚 Слова на неделю`, 
                    `Повторение ${WORD_SETS.find(s => s.id === weekData.wordSetId)?.cards.length || 0} слов`,
                    `window.App.promptForDirection('${weekData.wordSetId}', 'practice')`,
                    'bg-green-100 hover:bg-green-200'
                );
                
                // 5. Полезные фразы / Диалоги на тему (ВНЕШНЯЯ ССЫЛКА)
                this.renderMenuCard(contentListDiv, 
                    `🗣️ Полезные фразы / Диалоги на тему`, 
                    `Внешняя ссылка`,
                    `window.App.renderExternalLinkScreen('🗣️ Диалоги Недели ${weekNum}', '${weekData.dialoguesLink}', 'week-content', ${weekNum})` 
                );

                this.showScreen('list-screen');
                
                // Дополнительный вызов для загрузки метаданных, если они еще не загружены
                if (this.carouselSetsMetadata.length === 0) {
                     this.loadCarouselMetadata().then(() => {
                         // Перерисовываем экран, чтобы отобразить активную кнопку карусели
                         this.renderWeekContent(weekNum); 
                     });
                }
            },
            
            /**
             * Рендерит карточку меню для недели
             */
            renderMenuCard(container, title, subtitle, onClickAction, style = 'bg-white hover:bg-gray-50') {
                const button = document.createElement('button');
                button.className = `w-full text-left p-4 ${style} rounded-xl shadow-md flex justify-between items-center transition duration-150`;
                button.setAttribute('onclick', onClickAction);
                
                button.innerHTML = `
                    <div>
                        <span class="font-semibold text-lg text-gray-800">${title}</span>
                        <span class="block text-sm text-gray-500">${subtitle}</span>
                    </div>
                    <span>&rarr;</span>
                `;
                container.appendChild(button);
            },
            
            /**
             * Рендерит экран с видео или просто текстом (для заданий/ассоциаций недели)
             */
            renderVideoContentScreen(title, videoUrl, textContent, fromScreen, fromParam) {
                this.returnContext = { screen: fromScreen, param: fromParam };
                
                document.getElementById('video-title').textContent = title;
                const videoIframe = document.getElementById('video-embed');
                const extraTextDiv = document.getElementById('video-extra-text');

                if (videoUrl) {
                    videoIframe.src = videoUrl;
                    videoIframe.style.display = 'block';
                } else {
                    videoIframe.src = '';
                    videoIframe.style.display = 'none';
                }
                
                if (textContent) {
                    extraTextDiv.innerHTML = `<p>${textContent}</p>`;
                    extraTextDiv.style.display = 'block';
                } else {
                    extraTextDiv.innerHTML = '';
                    extraTextDiv.style.display = 'none';
                }
                
                this.renderBackButton(fromScreen, fromParam, 'video-content-screen');
                this.showScreen('video-content-screen');
            },
            
            /**
             * Рендерит экран для перехода по внешней ссылке
             */
            renderExternalLinkScreen(title, url, fromScreen, fromParam) {
                this.returnContext = { screen: fromScreen, param: fromParam };

                document.getElementById('external-link-title').textContent = title;
                const button = document.getElementById('external-link-button');
                const urlDisplay = document.getElementById('external-link-url-display');
                
                button.href = url;
                urlDisplay.textContent = url;
                
                this.renderBackButton(fromScreen, fromParam, 'external-link-screen');
                this.showScreen('external-link-screen');

                // Пытаемся открыть ссылку сразу, если это Telegram Web App
                if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openLink) {
                    window.Telegram.WebApp.openLink(url);
                }
            },

            /**
             * Загружает и отображает HTML-контент (например, text1.html) внутри SPA.
             * ЭТОТ ФУНКЦИЯ БЫЛА ИСПРАВЛЕНА ДЛЯ ПРИНУДИТЕЛЬНОГО ВЫПОЛНЕНИЯ СКРИПТОВ.
             */
            async renderStoryScreen(title, url, fromScreen, fromParam) {
                this.returnContext = { screen: fromScreen, param: fromParam };
                
                document.getElementById('content-viewer-title').textContent = title;
                this.renderBackButton(fromScreen, fromParam, 'content-viewer-screen');
                
                const contentBody = document.getElementById('content-viewer-body');
                contentBody.innerHTML = '<p class="text-center text-gray-500 py-10">Загрузка контента...</p>';

                this.showScreen('content-viewer-screen');

                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('Network response was not ok');
                    let htmlContent = await response.text();
                    
                    // 1. Изолируем и чистим HTML
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');
                    
                    // Извлекаем чистый контент из <body>
                    const innerContent = doc.body ? doc.body.innerHTML : htmlContent;
                    
                    // 2. Вставляем HTML
                    contentBody.innerHTML = innerContent;
                    
                    // 3. Выполняем скрипты
                    const scripts = doc.querySelectorAll('script');
                    scripts.forEach(script => {
                        // Клонируем и вставляем скрипт, чтобы он выполнился
                        const newScript = document.createElement('script');
                        // Копируем атрибуты
                        script.getAttributeNames().forEach(attr => {
                            newScript.setAttribute(attr, script.getAttribute(attr));
                        });
                        if (script.src) {
                            newScript.src = script.src;
                        } else {
                            newScript.textContent = script.textContent;
                        }
                        // Добавляем новый скрипт в конец body, чтобы он выполнился
                        contentBody.appendChild(newScript);
                    });
                    
                    // 4. После выполнения всех скриптов (включая init в text1.html), 
                    // нужно убедиться, что все ссылки (Tailwind) применены.
                    // Для инициализации логики text1.html может потребоваться явный вызов init.
                    const storyApp = window.App; // Логика text1.html переопределяет window.App
                    if (storyApp && typeof storyApp.init === 'function') {
                         storyApp.init();
                    }


                } catch (error) {
                    contentBody.innerHTML = `<p class="text-red-500 text-center py-10">Ошибка загрузки контента: ${error.message}</p>`;
                    console.error('Error loading story content:', error);
                }
            },


            renderAllSetsScreen() {
                // (Логика отображения "Все наборы слов" - не изменена)
                document.getElementById('list-title').innerText = '📚 Все наборы слов';
                this.renderBackButton('home-screen');
                
                this.renderSetFilterControls();
                
                const filteredSets = WORD_SETS.filter(set => {
                    const weekMatch = this.currentWeekFilter === 'All' || set.week.toString() === this.currentWeekFilter;
                    const unlockedMatch = set.week <= this.unlockedWeek; 
                    return weekMatch && unlockedMatch;
                });
                
                this.renderSetCards(filteredSets);
                this.showScreen('list-screen');
            },

            // ==================== ФИЛЬТРЫ И КАРТОЧКИ ====================

            /**
             * Рендерит кнопку "Назад" с учетом контекста
             */
            renderBackButton(target, param = null, screenOverride = null) {
                let containerId;
                switch(screenOverride) {
                    case 'video-content-screen':
                        containerId = 'video-back-button-container';
                        break;
                    case 'external-link-screen':
                        containerId = 'external-link-back-button-container';
                        break;
                    case 'content-viewer-screen':
                        containerId = 'content-viewer-back-button-container';
                        break;
                    case 'carousel-list-screen':
                        containerId = 'carousel-list-back-button-container';
                        break;
                    case 'image-carousel-screen':
                        containerId = 'carousel-back-button-container';
                        break;
                    default:
                        containerId = 'back-button-container';
                }
                
                const backBtnContainer = document.getElementById(containerId);
                
                if (!backBtnContainer) return; 

                let targetFunction;
                
                switch (target) {
                    case 'home-screen':
                        targetFunction = 'window.App.renderHomeScreen()';
                        break;
                    case 'weekly-selections':
                        targetFunction = 'window.App.renderWeeklySelections()';
                        break;
                    case 'week-content':
                        targetFunction = `window.App.renderWeekContent(${param})`; 
                        break;
                    case 'carousel-list':
                        targetFunction = `window.App.renderCarouselListScreen()`; 
                        break;
                    default:
                        targetFunction = 'window.App.renderHomeScreen()';
                }

                backBtnContainer.innerHTML = `
                    <button onclick="${targetFunction}" class="text-blue-500 hover:text-blue-700 font-semibold flex items-center">
                        <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        Назад
                    </button>
                `;
            },
            
            renderSetFilterControls() {
                // (Логика фильтров для "Все наборы слов" - не изменена)
                const filterControls = document.getElementById('filter-controls');
                filterControls.innerHTML = `
                    <div class="grid grid-cols-2 gap-3">
                        <!-- Фильтр по Неделе -->
                        <select id="week-filter" onchange="window.App.updateSetFilter('week', this.value)" 
                                class="p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            <option value="All">Все Недели</option>
                            ${ALL_WEEKS.map(w => `<option value="${w}" ${this.currentWeekFilter === w.toString() ? 'selected' : ''}>Неделя ${w}</option>`).join('')}
                        </select>
                    </div>
                `;
            },
            
            updateSetFilter(filterType, value) {
                if (filterType === 'week') {
                    this.currentWeekFilter = value;
                }
                this.renderAllSetsScreen();
            },

            renderSetCards(setsToRender) {
                // (Логика отображения карточек наборов слов - не изменена)
                const contentListDiv = document.getElementById('content-list');
                contentListDiv.innerHTML = '';
                const today = this.getTodayDateString();

                if (setsToRender.length === 0) {
                    contentListDiv.innerHTML = '<p class="text-gray-500 text-center py-6">Нет наборов, удовлетворяющих условиям фильтрации.</p>';
                    return;
                }

                setsToRender.forEach(set => {
                    let dueCount = 0;
                    set.cards.forEach(card => {
                        const progress = this.userProgress[card.id];
                        if (!progress || (progress.nextReview && progress.nextReview <= today)) {
                            dueCount++;
                        }
                    });

                    const setContainer = document.createElement('div');
                    setContainer.className = "w-full p-4 bg-white rounded-xl shadow-md";
                    
                    setContainer.innerHTML = `
                        <div class="flex justify-between items-center mb-3">
                            <div>
                                <span class="font-semibold text-gray-800 text-lg">${set.name}</span>
                                <span class="block text-sm text-gray-500">Неделя ${set.week} | ${set.cards.length} слов</span>
                            </div>
                            ${dueCount > 0 ? 
                                `<span class="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">${dueCount} к повтору</span>` :
                                `<span class="text-green-500 font-semibold">✓</span>`
                            }
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <button class="w-full py-2 px-3 bg-blue-500 text-white font-semibold rounded-xl text-sm hover:bg-blue-600 transition duration-150" 
                                    onclick="window.App.promptForDirection('${set.id}', 'review')">
                                Повторить (${dueCount})
                            </button>
                            <button class="w-full py-2 px-3 bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-300 transition duration-150" 
                                    onclick="window.App.promptForDirection('${set.id}', 'practice')">
                                Практика (Все)
                            </button>
                        </div>
                    `;
                    contentListDiv.appendChild(setContainer);
                });
            },
            
            // ==================== ЛОГИКА КАРУСЕЛИ ====================
            
            /**
             * Загружает метаданные всех каруселей (carousel_sets.json).
             */
            async loadCarouselMetadata() {
                try {
                    const response = await fetch(getBaseUrl() + 'carousel_sets.json');
                    if (!response.ok) {
                        throw new Error(`Ошибка HTTP: ${response.status} ${response.statusText}`);
                    }
                    let rawResponseText = await response.text(); 
                    this.carouselSetsMetadata = JSON.parse(rawResponseText);
                    return true;
                } catch (error) {
                    console.error('Carousel Metadata Load Error:', error);
                    return false;
                }
            },


            /**
             * Загружает метаданные всех каруселей и отображает список (ИСПОЛЬЗУЕТСЯ ТОЛЬКО ДЛЯ ЭКРАНА СПИСКА)
             */
            async renderCarouselListScreen(fromScreen, fromParam) {
                this.carouselReturnContext = { screen: fromScreen, param: fromParam };
                
                document.getElementById('carousel-list-title').innerText = 'Карусель ассоциаций';
                this.renderBackButton(fromScreen, fromParam, 'carousel-list-screen');
                
                const listDiv = document.getElementById('carousel-sets-list');
                listDiv.innerHTML = '<p class="text-center text-gray-500 py-6">Загрузка списка наборов...</p>';
                this.showScreen('carousel-list-screen');
                
                if (this.carouselSetsMetadata.length === 0) {
                   await this.loadCarouselMetadata();
                }

                if (this.carouselSetsMetadata.length === 0) {
                     listDiv.innerHTML = '<p class="text-red-500 text-center py-6">Ошибка: Не удалось загрузить список наборов каруселей.</p>';
                     return;
                }
                
                listDiv.innerHTML = '';

                this.carouselSetsMetadata.forEach(set => {
                    const button = document.createElement('button');
                    button.className = 'w-full py-4 px-5 bg-white rounded-xl shadow-md text-left text-lg font-semibold text-gray-800 hover:bg-gray-50 flex justify-between items-center transition duration-150';
                    button.textContent = set.title;
                    button.innerHTML = `
                        <span>${set.title}</span>
                        <span class="text-sm text-gray-500">${set.wordCount} слов &rarr;</span>
                    `;
                    button.onclick = () => this.startCarouselSession(set.id, set.title, set.filepath, 'carousel-list', null);
                    listDiv.appendChild(button);
                });
            },
            
            async startCarouselSession(setId, setTitle, filepath, fromScreen, fromParam) {
                // Контекст для кнопки "Назад" в самой карусели
                if (fromScreen && fromParam !== undefined) {
                    this.carouselReturnContext = { screen: fromScreen, param: fromParam };
                } else {
                    // Если вызывается со страницы списка, возвращаемся к списку
                    this.carouselReturnContext = { screen: 'carousel-list', param: null };
                }
                
                const currentScreen = document.getElementById(this.currentScreenId);
                const loadingIndicator = document.createElement('p');
                loadingIndicator.className = "text-center text-gray-500 py-6";
                loadingIndicator.textContent = `Загрузка набора "${setTitle}"...`;
                
                // Временно отображаем индикатор загрузки
                if (currentScreen) {
                    currentScreen.appendChild(loadingIndicator);
                }
                
                this.showScreen('loading-screen'); // Показываем общий экран загрузки на время fetch
                
                try {
                    const response = await fetch(getBaseUrl() + filepath);
                    if (!response.ok) throw new Error(`Не удалось загрузить данные набора: ${filepath}`);
                    
                    let rawResponseText = await response.text(); 
                    this.carouselCards = JSON.parse(rawResponseText);

                    if (this.carouselCards.length === 0) {
                        throw new Error('Набор пуст.');
                    }

                    this.currentCarouselIndex = 0;
                    this.showCarouselCard();
                    this.showScreen('image-carousel-screen');
                    
                } catch (error) {
                    this.showScreen('loading-screen');
                    document.getElementById('loading-screen').innerHTML = `<p class="text-red-500 text-center py-6">Ошибка загрузки карусели: ${error.message}</p>`;
                    console.error('Carousel Data Load Error:', error);
                }
            },

            showCarouselCard() {
                const card = this.carouselCards[this.currentCarouselIndex];
                
                document.getElementById('carousel-word-count').textContent = `Слово ${this.currentCarouselIndex + 1} из ${this.carouselCards.length}`;
                document.getElementById('carousel-image').src = card.image;
                document.getElementById('carousel-word').textContent = card.word;
                document.getElementById('carousel-translation').textContent = card.translation;
                
                // Скрываем перевод по умолчанию
                document.getElementById('carousel-translation').classList.add('hidden');
                document.getElementById('toggle-translation-button').textContent = 'Показать перевод';

                // Обновляем кнопку назад
                this.renderBackButton(this.carouselReturnContext.screen, this.carouselReturnContext.param, 'image-carousel-screen');
            },

            showNextWord() {
                this.currentCarouselIndex = (this.currentCarouselIndex + 1) % this.carouselCards.length;
                this.showCarouselCard();
            },

            showPrevWord() {
                this.currentCarouselIndex = (this.currentCarouselIndex - 1 + this.carouselCards.length) % this.carouselCards.length;
                this.showCarouselCard();
            },
            
            toggleTranslation() {
                const translationEl = document.getElementById('carousel-translation');
                const button = document.getElementById('toggle-translation-button');
                
                const isHidden = translationEl.classList.contains('hidden');
                
                if (isHidden) {
                    translationEl.classList.remove('hidden');
                    button.textContent = 'Скрыть перевод';
                    // Пытаемся воспроизвести слово при показе перевода
                    this.speakGerman(this.carouselCards[this.currentCarouselIndex].word); 
                } else {
                    translationEl.classList.add('hidden');
                    button.textContent = 'Показать перевод';
                }
            },

            returnToCarouselList() {
                 // Возвращаемся в контекст, откуда пришли (либо список недель, либо список каруселей)
                 const { screen, param } = this.carouselReturnContext;
                 if (screen === 'week-content' && param !== null) {
                    this.renderWeekContent(param);
                 } else {
                    this.renderCarouselListScreen(this.carouselReturnContext.screen, this.carouselReturnContext.param);
                 }
            },


            // ==================== ЛОГИКА ПОВТОРЕНИЯ ====================

            promptForDirection(setId, mode) {
                this.tempSetId = setId;
                this.tempMode = mode;
                this.openModal('direction-modal');
            },

            closeDirectionModal() {
                this.closeModal('direction-modal');
            },

            startSessionWithDirection(direction) {
                this.currentDirection = direction;
                this.closeDirectionModal();
                this.startSession(this.tempSetId, this.tempMode);
            },
            
            startSession(setId, mode) {
                const set = WORD_SETS.find(s => s.id === setId);
                if (!set) return;

                this.isPracticeMode = (mode === 'practice');
                
                if (this.isPracticeMode) {
                    this.sessionCards = set.cards.map(card => ({...card})); 
                } else {
                    const today = this.getTodayDateString();
                    this.sessionCards = set.cards.filter(card => {
                        const progress = this.userProgress[card.id];
                        return !progress || (progress.nextReview && progress.nextReview <= today);
                    });
                }
                
                if (this.sessionCards.length === 0) {
                    this.showScreen('finish-screen');
                    document.getElementById('finish-screen-text').textContent = this.isPracticeMode 
                        ? 'В этом наборе нет карточек.' 
                        : 'Для этого набора нет карточек к повторению на сегодня!';
                    return;
                }
                
                this.sessionCards.sort(() => Math.random() - 0.5);
                this.currentCardIndex = 0;
                
                this.showScreen('study-screen');
                this.showNextCard();
            },

            showAnswer() {
                document.getElementById('card').classList.add('is-flipped');
                document.getElementById('controls-show').classList.add('hidden');
                document.getElementById('controls-rate').classList.remove('hidden');
            },
            
            showNextCard() {
                if (this.currentCardIndex >= this.sessionCards.length) {
                    this.showScreen('finish-screen');
                    document.getElementById('finish-screen-text').textContent = 'Вы прошли все карточки в этой сессии.';
                    return;
                }
                
                const cardEl = document.getElementById('card');
                
                cardEl.classList.remove('is-flipped');
                cardEl.classList.add('slide-in');
                setTimeout(() => cardEl.classList.remove('slide-in'), 400);

                const totalCards = this.sessionCards.length;
                const currentCount = this.currentCardIndex + 1;
                const percent = (currentCount / totalCards) * 100;
                document.getElementById('progress-bar').style.width = `${percent}%`;

                document.getElementById('controls-show').classList.remove('hidden');
                document.getElementById('controls-rate').classList.add('hidden');

                const card = this.sessionCards[this.currentCardIndex];
                
                const speakerIconSvg = `
                    <svg class="w-6 h-6 text-blue-500 hover:text-blue-700 inline-block ml-2 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 6v12a1 1 0 01-1.707.707L5.586 15z"></path>
                    </svg>
                `;
                
                const germanHtml = `
                    <div class="flex items-center justify-center gap-2">
                        <span>${card.back}</span>
                        <span onclick="window.App.speakGerman('${card.back}', event)">
                            ${speakerIconSvg}
                        </span>
                    </div>
                `;

                if (this.currentDirection === 'ru-de') {
                    document.getElementById('card-front-text').textContent = card.front;
                    document.getElementById('card-back-text').innerHTML = germanHtml;
                } else {
                    document.getElementById('card-front-text').innerHTML = germanHtml;
                    document.getElementById('card-back-text').textContent = card.front;
                }
                
                const hintButton = document.getElementById('hint-button');
                if (card.hintImage) {
                    hintButton.classList.remove('hidden');
                } else {
                    hintButton.classList.add('hidden');
                }
            },
            
            async handleAnswer(knewIt) {
                if (this.isAdvancing) return; 
                this.isAdvancing = true;

                if (!this.isPracticeMode) {
                    const card = this.sessionCards[this.currentCardIndex];
                    let progress = this.userProgress[card.id] || { box: 0 };

                    if (knewIt) {
                        progress.box = Math.min(6, (progress.box || 0) + 1);
                    } else {
                        progress.box = 1;
                    }
                    
                    const interval = REPETITION_INTERVALS[progress.box];
                    progress.nextReview = this.getFutureDateString(interval);
                    
                    this.userProgress[card.id] = progress;
                    if (this.db) {
                        this.saveProgress(); 
                    }
                }
                
                document.getElementById('card').classList.add('slide-out');
                setTimeout(() => {
                    document.getElementById('card').classList.remove('slide-out'); 
                    this.currentCardIndex++; 
                    this.isAdvancing = false; 
                    this.showNextCard(); 
                }, 400); 
            },
            
            speakGerman(textToSpeak, event) {
                if (event) {
                    event.stopPropagation(); 
                }
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(textToSpeak);
                    utterance.lang = 'de-DE'; 
                    const voices = window.speechSynthesis.getVoices().filter(v => v.lang.includes('de-'));
                    if (voices.length > 0) {
                        utterance.voice = voices.find(v => v.name.includes('Anna')) || voices.find(v => v.name.includes('Google')) || voices[0];
                    }
                    window.speechSynthesis.speak(utterance);
                } else {
                    console.log('Ваш браузер не поддерживает синтез речи.');
                }
            },

            // ==================== УТИЛИТЫ ====================

            openModal(modalId) {
                const modal = document.getElementById(modalId);
                const modalContent = document.getElementById(`${modalId}-content`) || document.getElementById(`${modalId}-modal-content`);
                
                if (modal) {
                    modal.classList.remove('hidden');
                    setTimeout(() => {
                        modal.classList.add('is-open', 'opacity-100');
                        if (modalContent) {
                            modalContent.classList.add('is-open');
                        }
                    }, 10);
                }
            },
            
            closeModal(modalId) {
                const modal = document.getElementById(modalId);
                const modalContent = document.getElementById(`${modalId}-content`) || document.getElementById(`${modalId}-modal-content`);
                
                if (modal) {
                    modal.classList.remove('is-open', 'opacity-100');
                    if (modalContent) {
                        modalContent.classList.remove('is-open');
                    }
                    setTimeout(() => {
                        modal.classList.add('hidden');
                    }, 300);
                }
            },
            
            showHint() {
                const card = this.sessionCards[this.currentCardIndex];
                if (!card || !card.hintImage) return;
                const img = document.getElementById('hint-image');
                img.src = card.hintImage; 
                this.openModal('hint-modal');
            },

            closeHintModal() {
                this.closeModal('hint-modal');
            },
            
            showScreen(screenId) {
                this.currentScreenId = screenId;
                ['loading-screen', 'home-screen', 'list-screen', 'study-screen', 'finish-screen', 'video-content-screen', 'external-link-screen', 'content-viewer-screen', 'carousel-list-screen', 'image-carousel-screen'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.classList.add('hidden');
                });
                const screen = document.getElementById(screenId);
                if (screen) {
                    screen.classList.remove('hidden');
                }
            },
            
            showError(message) {
                this.showScreen('loading-screen');
                const loadingScreen = document.getElementById('loading-screen');
                if (loadingScreen) {
                    loadingScreen.innerHTML = `<p class="text-red-500 font-semibold">${message}</p>`;
                }
            },
            
            getTodayDateString() {
                return new Date().toISOString().split('T')[0];
            },

            getFutureDateString(daysToAdd) {
                const date = new Date();
                date.setDate(date.getDate() + daysToAdd);
                return date.toISOString().split('T')[0];
            }
        };
        
        // ==========================================================
        // 3. ЗАПУСК ПРИЛОЖЕНИЯ (Conceptual Bootstrap)
        // ==========================================================

        window.addEventListener('load', () => {
            // Предзагрузка голосов для синтеза речи
            if ('speechSynthesis' in window) {
                window.speechSynthesis.getVoices(); 
                if (window.speechSynthesis.onvoiceschanged !== undefined) {
                    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
                }
            }
            window.App.init();
        });

    </script>