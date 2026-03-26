// ===== N2 Grammar Noti App =====
(function () {
    'use strict';

    // ===== State =====
    let grammarData = [];
    let savedGrammars = JSON.parse(localStorage.getItem('n2_saved') || '[]');
    let studiedGrammars = JSON.parse(localStorage.getItem('n2_studied') || '[]');
    let quizHighScore = parseInt(localStorage.getItem('n2_quiz_score') || '0');
    let currentDailyId = parseInt(localStorage.getItem('n2_daily_id') || '1');
    let notiEnabled = localStorage.getItem('n2_noti_enabled') === 'true';
    let notiInterval = parseInt(localStorage.getItem('n2_noti_interval') || '60');
    let notiTimerId = null;
    let oneSignal = null;

    // OneSignal App ID - onesignal.com မှာ account ဆောက်ပြီး ရလာသော ID ကို ဒီနေရာ ထည့်ပါ
    const ONESIGNAL_APP_ID = '98270062-445c-4652-a5ca-f2222a4272f5';
    let currentFilter = 'all';
    let currentModalGrammar = null;
    let quizQuestions = [];
    let quizIndex = 0;
    let quizCorrect = 0;
    let quizAnswered = false;

    // ===== DOM Refs =====
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ===== Init =====
    async function init() {
        try {
            const resp = await fetch('n2_shinkanzen_grammar_mm.json');
            const data = await resp.json();
            grammarData = data.grammar_points;
        } catch (e) {
            console.error('Failed to load grammar data:', e);
            grammarData = [];
        }

        // Set daily grammar based on date
        const today = new Date();
        const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        currentDailyId = (dayOfYear % grammarData.length) + 1;
        localStorage.setItem('n2_daily_id', currentDailyId);

        setupEventListeners();
        renderDailyCard();
        renderProgress();
        renderGrammarList();
        renderSavedList();
        loadNotiSettings();
        initOneSignal();

        // Splash -> Main
        setTimeout(() => {
            $('#splash-screen').classList.add('fade-out');
            setTimeout(() => {
                $('#splash-screen').style.display = 'none';
                $('#main-app').classList.remove('hidden');
            }, 600);
        }, 1800);
    }

    // ===== Event Listeners =====
    function setupEventListeners() {
        // Tab navigation
        $$('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                $$('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                $$('.page').forEach(p => p.classList.remove('active'));
                $(`#page-${tab}`).classList.add('active');
            });
        });

        // Search
        $('#btn-search-toggle').addEventListener('click', () => {
            const bar = $('#search-bar');
            bar.classList.toggle('hidden');
            if (!bar.classList.contains('hidden')) {
                $('#search-input').focus();
            }
        });

        $('#search-input').addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            renderGrammarList(query);
        });

        $('#btn-search-clear').addEventListener('click', () => {
            $('#search-input').value = '';
            renderGrammarList();
        });

        // Noti settings button -> scroll to settings or switch to home
        $('#btn-noti-settings').addEventListener('click', () => {
            // Switch to home tab
            $$('.tab-btn').forEach(b => b.classList.remove('active'));
            $$('.tab-btn')[0].classList.add('active');
            $$('.page').forEach(p => p.classList.remove('active'));
            $('#page-home').classList.add('active');
            // Scroll to noti settings
            setTimeout(() => {
                $('#noti-settings-section').scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        // Daily card
        $('#btn-refresh-daily').addEventListener('click', () => {
            currentDailyId = Math.floor(Math.random() * grammarData.length) + 1;
            renderDailyCard();
        });

        $('#btn-daily-save').addEventListener('click', () => {
            if (currentModalGrammar === null) {
                const g = grammarData.find(g => g.id === currentDailyId);
                if (g) toggleSaved(g.id);
            }
        });

        $('#btn-daily-detail').addEventListener('click', () => {
            const g = grammarData.find(g => g.id === currentDailyId);
            if (g) openModal(g);
        });

        // Filter buttons
        $$('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                renderGrammarList();
            });
        });

        // Modal
        $('#btn-modal-close').addEventListener('click', closeModal);
        $('.modal-overlay').addEventListener('click', closeModal);
        $('#btn-modal-save').addEventListener('click', () => {
            if (currentModalGrammar) toggleSaved(currentModalGrammar.id);
        });
        $('#btn-modal-studied').addEventListener('click', () => {
            if (currentModalGrammar) toggleStudied(currentModalGrammar.id);
        });

        // Quiz
        $('#btn-start-quiz').addEventListener('click', startQuiz);
        $('#btn-retry-quiz').addEventListener('click', () => {
            $('#quiz-result').classList.add('hidden');
            $('#quiz-start').classList.remove('hidden');
        });

        // Notification toggle
        $('#noti-toggle').addEventListener('change', (e) => {
            if (e.target.checked) {
                enableNotifications();
            } else {
                disableNotifications();
            }
        });

        $('#noti-interval').addEventListener('change', (e) => {
            notiInterval = parseInt(e.target.value);
            localStorage.setItem('n2_noti_interval', notiInterval);
            if (notiEnabled) {
                restartNotiTimer();
            }
        });
    }

    // ===== Daily Card =====
    function renderDailyCard() {
        const g = grammarData.find(g => g.id === currentDailyId);
        if (!g) return;

        $('#daily-grammar').textContent = g.grammar;
        $('#daily-reading').textContent = g.reading;
        $('#daily-meaning').textContent = g.meaning_myanmar;
        $('#daily-pattern').textContent = g.pattern;

        // Example
        const exDiv = $('#daily-example');
        if (g.examples && g.examples.length > 0) {
            const ex = g.examples[0];
            exDiv.innerHTML = `
                <div class="example-jp">${ex.japanese}</div>
                <div class="example-mm">${ex.myanmar}</div>
            `;
        } else {
            exDiv.innerHTML = '';
        }

        // Save button state
        updateDailySaveBtn();
    }

    function updateDailySaveBtn() {
        const btn = $('#btn-daily-save');
        if (savedGrammars.includes(currentDailyId)) {
            btn.classList.add('saved');
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Saved`;
        } else {
            btn.classList.remove('saved');
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Save`;
        }
    }

    // ===== Progress =====
    function renderProgress() {
        $('#total-studied').textContent = studiedGrammars.length;
        $('#total-saved').textContent = savedGrammars.length;
        $('#quiz-score').textContent = quizHighScore;
        const percent = grammarData.length > 0 ? Math.round((studiedGrammars.length / grammarData.length) * 100) : 0;
        $('#progress-percent').textContent = percent + '%';
        $('#progress-bar-fill').style.width = percent + '%';
    }

    // ===== Grammar List =====
    function renderGrammarList(searchQuery = '') {
        const list = $('#grammar-list');
        let items = [...grammarData];

        // Filter
        if (currentFilter === 'studied') {
            items = items.filter(g => studiedGrammars.includes(g.id));
        } else if (currentFilter === 'not-studied') {
            items = items.filter(g => !studiedGrammars.includes(g.id));
        }

        // Search
        if (searchQuery) {
            items = items.filter(g =>
                g.grammar.toLowerCase().includes(searchQuery) ||
                g.reading.toLowerCase().includes(searchQuery) ||
                g.meaning_myanmar.toLowerCase().includes(searchQuery) ||
                g.english.toLowerCase().includes(searchQuery)
            );
        }

        $('#grammar-count').textContent = items.length;

        list.innerHTML = items.map(g => {
            const isStudied = studiedGrammars.includes(g.id);
            const isSaved = savedGrammars.includes(g.id);
            return `
                <div class="grammar-item" data-id="${g.id}">
                    <div class="grammar-item-num ${isStudied ? 'studied' : ''}">${g.id}</div>
                    <div class="grammar-item-content">
                        <div class="grammar-item-title">${g.grammar}</div>
                        <div class="grammar-item-meaning">${g.meaning_myanmar}</div>
                    </div>
                    <button class="grammar-item-bookmark ${isSaved ? 'saved' : ''}" data-id="${g.id}" aria-label="Bookmark">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    </button>
                </div>
            `;
        }).join('');

        // Click handlers
        list.querySelectorAll('.grammar-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.grammar-item-bookmark')) return;
                const id = parseInt(item.dataset.id);
                const g = grammarData.find(g => g.id === id);
                if (g) openModal(g);
            });
        });

        list.querySelectorAll('.grammar-item-bookmark').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                toggleSaved(id);
            });
        });
    }

    // ===== Saved List =====
    function renderSavedList() {
        const list = $('#saved-list');
        const items = grammarData.filter(g => savedGrammars.includes(g.id));

        $('#saved-count').textContent = items.length;

        if (items.length === 0) {
            list.innerHTML = '';
            $('#saved-empty').classList.remove('hidden');
            return;
        }

        $('#saved-empty').classList.add('hidden');

        list.innerHTML = items.map(g => {
            const isStudied = studiedGrammars.includes(g.id);
            return `
                <div class="grammar-item" data-id="${g.id}">
                    <div class="grammar-item-num ${isStudied ? 'studied' : ''}">${g.id}</div>
                    <div class="grammar-item-content">
                        <div class="grammar-item-title">${g.grammar}</div>
                        <div class="grammar-item-meaning">${g.meaning_myanmar}</div>
                    </div>
                    <button class="grammar-item-bookmark saved" data-id="${g.id}" aria-label="Remove Bookmark">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    </button>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.grammar-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.grammar-item-bookmark')) return;
                const id = parseInt(item.dataset.id);
                const g = grammarData.find(g => g.id === id);
                if (g) openModal(g);
            });
        });

        list.querySelectorAll('.grammar-item-bookmark').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                toggleSaved(id);
            });
        });
    }

    // ===== Modal =====
    function openModal(g) {
        currentModalGrammar = g;
        $('#modal-id').textContent = `#${g.id}`;
        $('#modal-grammar').textContent = g.grammar;
        $('#modal-reading').textContent = g.reading;
        $('#modal-meaning-mm').textContent = g.meaning_myanmar;
        $('#modal-meaning-en').textContent = g.english;
        $('#modal-pattern').textContent = g.pattern;
        $('#modal-notes').textContent = g.notes || '';

        // Examples
        const exDiv = $('#modal-examples');
        if (g.examples && g.examples.length > 0) {
            exDiv.innerHTML = g.examples.map(ex => `
                <div class="modal-example-item">
                    <div class="modal-example-jp">${ex.japanese}</div>
                    <div class="modal-example-mm">${ex.myanmar}</div>
                </div>
            `).join('');
        } else {
            exDiv.innerHTML = '<p style="color:var(--text-dim)">ဥပမာ မရှိပါ</p>';
        }

        // Button states
        updateModalButtons();

        // Mark as studied
        if (!studiedGrammars.includes(g.id)) {
            studiedGrammars.push(g.id);
            localStorage.setItem('n2_studied', JSON.stringify(studiedGrammars));
            renderProgress();
            renderGrammarList();
        }

        $('#grammar-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        $('#grammar-modal').classList.add('hidden');
        document.body.style.overflow = '';
        currentModalGrammar = null;
    }

    function updateModalButtons() {
        if (!currentModalGrammar) return;
        const id = currentModalGrammar.id;

        // Save button
        const saveBtn = $('#btn-modal-save');
        if (savedGrammars.includes(id)) {
            saveBtn.classList.add('saved');
            saveBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Saved`;
        } else {
            saveBtn.classList.remove('saved');
            saveBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Save`;
        }

        // Studied button
        const studiedBtn = $('#btn-modal-studied');
        if (studiedGrammars.includes(id)) {
            studiedBtn.classList.add('is-studied');
            studiedBtn.textContent = '✓ လေ့လာပြီးသား';
        } else {
            studiedBtn.classList.remove('is-studied');
            studiedBtn.textContent = '✓ လေ့လာပြီး';
        }
    }

    // ===== Toggle Saved/Studied =====
    function toggleSaved(id) {
        const idx = savedGrammars.indexOf(id);
        if (idx >= 0) {
            savedGrammars.splice(idx, 1);
            showToast('Bookmark ဖြုတ်ပြီးပါပြီ');
        } else {
            savedGrammars.push(id);
            showToast('Bookmark သိမ်းပြီးပါပြီ ⭐');
        }
        localStorage.setItem('n2_saved', JSON.stringify(savedGrammars));
        renderProgress();
        renderGrammarList();
        renderSavedList();
        updateDailySaveBtn();
        if (currentModalGrammar) updateModalButtons();
    }

    function toggleStudied(id) {
        const idx = studiedGrammars.indexOf(id);
        if (idx >= 0) {
            studiedGrammars.splice(idx, 1);
            showToast('လေ့လာပြီး ဖြုတ်ပြီးပါပြီ');
        } else {
            studiedGrammars.push(id);
            showToast('လေ့လာပြီး အဖြစ် မှတ်ပြီးပါပြီ ✓');
        }
        localStorage.setItem('n2_studied', JSON.stringify(studiedGrammars));
        renderProgress();
        renderGrammarList();
        if (currentModalGrammar) updateModalButtons();
    }

    // ===== Quiz =====
    function startQuiz() {
        const count = parseInt(document.querySelector('input[name="quiz-count"]:checked').value);
        quizQuestions = generateQuizQuestions(count);
        quizIndex = 0;
        quizCorrect = 0;
        quizAnswered = false;

        $('#quiz-start').classList.add('hidden');
        $('#quiz-result').classList.add('hidden');
        $('#quiz-active').classList.remove('hidden');
        $('#quiz-total').textContent = quizQuestions.length;

        renderQuizQuestion();
    }

    function generateQuizQuestions(count) {
        const shuffled = [...grammarData].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(count, shuffled.length));

        return selected.map(g => {
            // Generate 3 wrong choices
            const others = grammarData.filter(x => x.id !== g.id).sort(() => Math.random() - 0.5).slice(0, 3);
            const choices = [
                { text: g.meaning_myanmar, correct: true },
                ...others.map(o => ({ text: o.meaning_myanmar, correct: false }))
            ].sort(() => Math.random() - 0.5);

            return { grammar: g, choices };
        });
    }

    function renderQuizQuestion() {
        const q = quizQuestions[quizIndex];
        quizAnswered = false;

        $('#quiz-current').textContent = quizIndex + 1;
        $('#quiz-progress-fill').style.width = ((quizIndex) / quizQuestions.length * 100) + '%';
        $('#quiz-grammar').textContent = q.grammar.grammar;
        $('#quiz-pattern').textContent = q.grammar.pattern;

        const choicesDiv = $('#quiz-choices');
        choicesDiv.innerHTML = q.choices.map((c, i) => `
            <button class="quiz-choice" data-index="${i}">${c.text}</button>
        `).join('');

        choicesDiv.querySelectorAll('.quiz-choice').forEach(btn => {
            btn.addEventListener('click', () => handleQuizAnswer(btn, parseInt(btn.dataset.index)));
        });
    }

    function handleQuizAnswer(btn, index) {
        if (quizAnswered) return;
        quizAnswered = true;

        const q = quizQuestions[quizIndex];
        const isCorrect = q.choices[index].correct;

        // Disable all
        $$('.quiz-choice').forEach(b => b.classList.add('disabled'));

        if (isCorrect) {
            btn.classList.add('correct');
            quizCorrect++;
        } else {
            btn.classList.add('wrong');
            // Show correct answer
            const correctIdx = q.choices.findIndex(c => c.correct);
            $$('.quiz-choice')[correctIdx].classList.add('correct');
        }

        // Next question
        setTimeout(() => {
            quizIndex++;
            if (quizIndex < quizQuestions.length) {
                renderQuizQuestion();
            } else {
                showQuizResult();
            }
        }, 1200);
    }

    function showQuizResult() {
        $('#quiz-active').classList.add('hidden');
        $('#quiz-result').classList.remove('hidden');

        const total = quizQuestions.length;
        const percent = Math.round((quizCorrect / total) * 100);

        $('#result-correct').textContent = quizCorrect;
        $('#result-total').textContent = total;

        if (percent >= 80) {
            $('#result-icon').textContent = '🎉';
            $('#result-title').textContent = 'အရမ်းတော်တယ်!';
            $('#result-message').textContent = `${percent}% မှန်ပါတယ်။ N2 grammar ကောင်းကောင်း တတ်ပါတယ်!`;
        } else if (percent >= 50) {
            $('#result-icon').textContent = '👍';
            $('#result-title').textContent = 'ကောင်းပါတယ်!';
            $('#result-message').textContent = `${percent}% မှန်ပါတယ်။ ထပ်ကြိုးစားပါ!`;
        } else {
            $('#result-icon').textContent = '💪';
            $('#result-title').textContent = 'ဆက်ကြိုးစားပါ!';
            $('#result-message').textContent = `${percent}% မှန်ပါတယ်။ Grammar တွေ ထပ်လေ့လာပြီး ထပ်ကြိုးစားပါ!`;
        }

        // Update high score
        if (quizCorrect > quizHighScore) {
            quizHighScore = quizCorrect;
            localStorage.setItem('n2_quiz_score', quizHighScore);
            renderProgress();
        }
    }

    // ===== OneSignal Init =====
    function initOneSignal() {
        if (!ONESIGNAL_APP_ID || ONESIGNAL_APP_ID === 'YOUR_ONESIGNAL_APP_ID') return;

        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function (os) {
            oneSignal = os;
            await os.init({
                appId: ONESIGNAL_APP_ID,
                serviceWorkerPath: 'OneSignalSDKWorker.js',
                notifyButton: { enable: false }
            });
        });
    }

    // ===== Notifications =====
    function loadNotiSettings() {
        $('#noti-toggle').checked = notiEnabled;
        $('#noti-interval').value = notiInterval;

        if (notiEnabled) {
            startNotiTimer();
            updateNotiStatus(true);
        }
    }

    async function enableNotifications() {
        if (!('Notification' in window)) {
            showToast('ဒီ browser မှာ notification မပေးနိုင်ပါ');
            $('#noti-toggle').checked = false;
            return;
        }

        // OneSignal ရှိရင် OneSignal မှတဆင့် permission တောင်းသည် (screen-lock support)
        if (oneSignal) {
            try {
                await oneSignal.Notifications.requestPermission();
                if (oneSignal.Notifications.permission) {
                    await oneSignal.User.PushSubscription.optIn();
                }
            } catch (e) { }
        } else {
            await Notification.requestPermission();
        }

        if (Notification.permission === 'granted') {
            notiEnabled = true;
            localStorage.setItem('n2_noti_enabled', 'true');
            startNotiTimer();
            updateNotiStatus(true);
            showToast('🔔 Notification ဖွင့်ပြီးပါပြီ');
            sendGrammarNoti();
        } else {
            $('#noti-toggle').checked = false;
            showToast('Notification permission ခွင့်ပြုပါ');
        }
    }

    function disableNotifications() {
        notiEnabled = false;
        localStorage.setItem('n2_noti_enabled', 'false');
        clearInterval(notiTimerId);
        notiTimerId = null;
        updateNotiStatus(false);
        showToast('🔕 Notification ပိတ်ပြီးပါပြီ');

        // OneSignal unsubscribe
        if (oneSignal) {
            oneSignal.User.PushSubscription.optOut().catch(() => { });
        }

        // Stop SW-based timer
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => {
                const sw = navigator.serviceWorker.controller || reg.active;
                if (sw) sw.postMessage({ type: 'STOP_NOTI' });
            }).catch(() => { });
        }
    }

    function startNotiTimer() {
        if (notiTimerId) clearInterval(notiTimerId);
        notiTimerId = setInterval(() => {
            sendGrammarNoti();
        }, notiInterval * 60 * 1000);

        // SW-based timer for mobile background notifications
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => {
                const sw = navigator.serviceWorker.controller || reg.active;
                if (sw) sw.postMessage({ type: 'START_NOTI', interval: notiInterval });
            }).catch(() => { });
        }
    }

    function restartNotiTimer() {
        startNotiTimer();
        updateNotiStatus(true);
        showToast(`⏱ ${notiInterval} မိနစ် တစ်ကြိမ် noti တက်ပေးမယ်`);
    }

    function sendGrammarNoti() {
        if (!notiEnabled || Notification.permission !== 'granted') return;

        const randomG = grammarData[Math.floor(Math.random() * grammarData.length)];
        if (!randomG) return;

        if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(`📖 ${randomG.grammar}`, {
                    body: `${randomG.meaning_myanmar}\n${randomG.english}`,
                    icon: 'icons/icon-192.svg',
                    badge: 'icons/icon-192.svg',
                    tag: 'n2-grammar-noti',
                    renotify: true,
                    vibrate: [100, 50, 100],
                    data: { grammarId: randomG.id }
                });
            });
        } else {
            // Fallback
            new Notification(`📖 ${randomG.grammar}`, {
                body: `${randomG.meaning_myanmar}\n${randomG.english}`,
                icon: 'icons/icon-192.svg',
                badge: 'icons/icon-192.svg',
                tag: 'n2-grammar-noti',
                renotify: true,
                vibrate: [100, 50, 100]
            });
        }
    }

    function updateNotiStatus(active) {
        const badge = $('#noti-badge');
        const status = $('#noti-status');

        if (active) {
            badge.classList.add('active');
            status.textContent = `✅ ${notiInterval} မိနစ် တစ်ကြိမ် Grammar noti တက်ပေးနေပါသည်`;
            status.style.color = 'var(--success)';
        } else {
            badge.classList.remove('active');
            status.textContent = 'Notification မဖွင့်ရသေးပါ';
            status.style.color = '';
        }
    }

    // ===== Toast =====
    function showToast(message) {
        const toast = $('#toast');
        $('#toast-message').textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 2500);
    }

    // ===== Service Worker Registration =====
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('SW registered:', reg.scope);
        }).catch(err => {
            console.log('SW registration failed:', err);
        });
    }

    // ===== Start =====
    document.addEventListener('DOMContentLoaded', init);
})();
