// PCProMinesweeper: PCMinesweeperを継承したPRO版の実装
class PCProMinesweeper extends PCMinesweeper {
    constructor() {
        super();
        
        // PRO版専用の機能
        this.statistics = {
            gamesPlayed: 0,
            gamesWon: 0,
            bestTimes: {},
            currentStreak: 0,
            bestStreak: 0,
            totalPlayTime: 0
        };
        
        // リプレイ機能
        this.replayData = [];
        this.isReplaying = false;
        this.isRecording = true;
        
        // ヒント機能
        this.hintsUsed = 0;
        this.maxHints = 3;
        
        // アンドゥ/リドゥ機能
        this.moveHistory = [];
        this.redoHistory = [];
        this.maxHistorySize = 50;
        
        // チャレンジモード
        this.challengeMode = null;
        this.dailyChallengeSeed = null;
        
        // カスタムテーマ
        this.customThemes = {
            classic: { name: 'クラシック', primary: '#2196F3', secondary: '#FF9800' },
            ocean: { name: 'オーシャン', primary: '#006994', secondary: '#00ACC1' },
            forest: { name: 'フォレスト', primary: '#2E7D32', secondary: '#66BB6A' },
            sunset: { name: 'サンセット', primary: '#E65100', secondary: '#FFB74D' },
            galaxy: { name: 'ギャラクシー', primary: '#4A148C', secondary: '#AB47BC' }
        };
        this.currentTheme = 'classic';
        
        // サウンド設定
        this.soundEnabled = false;
        this.sounds = {};
        
        // CSPソルバー
        this.cspSolver = null;
        this.probabilityMode = false;
        this.assistMode = false; // 補助モード
        this.isRevealing = false; // 再帰的な開示処理中フラグ
        
        // 補助機能の視覚表示設定
        this.assistVisualEnabled = true;
        
        this.initPro();
    }
    
    initPro() {
        this.loadStatistics();
        this.loadSettings();
        this.setupProEventListeners();
        this.initSounds();
        this.initCSPSolver();
    }
    
    setupProEventListeners() {
        // 統計ボタン
        const statsBtn = document.getElementById('stats-btn');
        if (statsBtn) {
            statsBtn.addEventListener('click', () => this.showStatistics());
        }
        
        // ヒントボタン
        const hintBtn = document.getElementById('hint-btn');
        if (hintBtn) {
            hintBtn.addEventListener('click', () => this.useHint());
        }
        
        // アンドゥ/リドゥボタン
        const undoBtn = document.getElementById('undo-btn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undo());
        }
        
        const redoBtn = document.getElementById('redo-btn');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.redo());
        }
        
        // リプレイボタン
        const replayBtn = document.getElementById('replay-btn');
        if (replayBtn) {
            replayBtn.addEventListener('click', () => this.toggleReplay());
        }
        
        // チャレンジモードボタン
        const challengeBtn = document.getElementById('challenge-btn');
        if (challengeBtn) {
            challengeBtn.addEventListener('click', () => this.showChallengeMenu());
        }
        
        // テーマ選択
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => this.applyTheme(e.target.value));
        }
        
        // サウンドトグル
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => this.toggleSound());
        }
        
        // 確率表示ボタン
        const probabilityBtn = document.getElementById('probability-btn');
        if (probabilityBtn) {
            probabilityBtn.addEventListener('click', () => this.toggleProbabilityMode());
        }
        
        // 補助モードボタン
        const assistBtn = document.getElementById('assist-btn');
        if (assistBtn) {
            assistBtn.addEventListener('click', () => this.toggleAssistMode());
        }
        
        // 補助機能の視覚表示設定ボタン
        const assistVisualToggleBtn = document.getElementById('assist-visual-toggle-btn');
        if (assistVisualToggleBtn) {
            assistVisualToggleBtn.addEventListener('click', () => this.toggleAssistVisual());
        }
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'z':
                        e.preventDefault();
                        this.undo();
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redo();
                        break;
                    case 'h':
                        e.preventDefault();
                        this.useHint();
                        break;
                    case 's':
                        e.preventDefault();
                        this.showStatistics();
                        break;
                }
            }
        });
    }
    
    // 統計機能
    loadStatistics() {
        const saved = localStorage.getItem('minesweeper-pro-statistics');
        if (saved) {
            this.statistics = JSON.parse(saved);
        }
    }
    
    saveStatistics() {
        localStorage.setItem('minesweeper-pro-statistics', JSON.stringify(this.statistics));
    }
    
    updateStatistics(won) {
        this.statistics.gamesPlayed++;
        
        if (won) {
            this.statistics.gamesWon++;
            this.statistics.currentStreak++;
            if (this.statistics.currentStreak > this.statistics.bestStreak) {
                this.statistics.bestStreak = this.statistics.currentStreak;
            }
            
            // ベストタイムの更新
            const difficulty = this.currentDifficulty;
            if (!this.statistics.bestTimes[difficulty] || this.timer < this.statistics.bestTimes[difficulty]) {
                this.statistics.bestTimes[difficulty] = this.timer;
            }
        } else {
            this.statistics.currentStreak = 0;
        }
        
        this.saveStatistics();
    }
    
    showStatistics() {
        const modal = document.getElementById('stats-modal');
        if (!modal) return;
        
        const content = document.getElementById('stats-content');
        if (content) {
            const winRate = this.statistics.gamesPlayed > 0 
                ? Math.round((this.statistics.gamesWon / this.statistics.gamesPlayed) * 100) 
                : 0;
            
            let bestTimesHTML = '<h3>ベストタイム</h3><ul>';
            const difficultyNames = {
                'easy': '初級',
                'medium': '中級',
                'hard': '上級',
                'hiddeneasy': '裏初級',
                'hiddenmedium': '裏中級',
                'hiddenhard': '裏上級',
                'extreme': '極悪'
            };
            
            for (const [diff, time] of Object.entries(this.statistics.bestTimes)) {
                const minutes = Math.floor(time / 60);
                const seconds = time % 60;
                const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
                bestTimesHTML += `<li>${difficultyNames[diff] || diff}: ${timeStr}</li>`;
            }
            bestTimesHTML += '</ul>';
            
            content.innerHTML = `
                <h2>統計情報</h2>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">プレイ回数</span>
                        <span class="stat-value">${this.statistics.gamesPlayed}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">勝利回数</span>
                        <span class="stat-value">${this.statistics.gamesWon}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">勝率</span>
                        <span class="stat-value">${winRate}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">現在の連勝</span>
                        <span class="stat-value">${this.statistics.currentStreak}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">最高連勝</span>
                        <span class="stat-value">${this.statistics.bestStreak}</span>
                    </div>
                </div>
                ${bestTimesHTML}
                <button id="close-stats-btn">閉じる</button>
            `;
            
            // イベントリスナーを追加（setTimeoutを使用して確実にDOMが更新された後に追加）
            setTimeout(() => {
                const closeBtn = document.getElementById('close-stats-btn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => this.closeStatsModal());
                }
            }, 0);
        }
        
        modal.classList.add('show');
    }
    
    closeStatsModal() {
        const modal = document.getElementById('stats-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    // ヒント機能
    useHint() {
        if (this.gameOver || this.gameWon || this.hintsUsed >= this.maxHints) {
            return;
        }
        
        // 安全なセルを探す
        const safeCells = this.findSafeCells();
        if (safeCells.length > 0) {
            const randomSafe = safeCells[Math.floor(Math.random() * safeCells.length)];
            const cell = document.querySelector(`[data-row="${randomSafe.row}"][data-col="${randomSafe.col}"]`);
            if (cell) {
                cell.classList.add('hint-highlight');
                setTimeout(() => {
                    cell.classList.remove('hint-highlight');
                }, 2000);
            }
            this.hintsUsed++;
            this.updateHintButton();
            if (this.soundEnabled) this.playSound('hint');
        }
    }
    
    findSafeCells() {
        const safeCells = [];
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.revealed[row][col] && this.board[row][col] > 0) {
                    const neighbors = this.getNeighbors(row, col);
                    const unrevealed = neighbors.filter(n => !this.revealed[n.row][n.col]);
                    const flagged = neighbors.filter(n => this.flagged[n.row][n.col]);
                    
                    if (flagged.length === this.board[row][col]) {
                        // すべての地雷が特定されている場合、残りは安全
                        unrevealed.forEach(n => {
                            if (!this.flagged[n.row][n.col]) {
                                safeCells.push(n);
                            }
                        });
                    }
                }
            }
        }
        
        return safeCells;
    }
    
    getNeighbors(row, col) {
        const neighbors = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newRow = row + dr;
                const newCol = col + dc;
                if (this.isValidCell(newRow, newCol)) {
                    neighbors.push({ row: newRow, col: newCol });
                }
            }
        }
        return neighbors;
    }
    
    updateHintButton() {
        const hintBtn = document.getElementById('hint-btn');
        if (hintBtn) {
            hintBtn.textContent = `💡 ヒント (${this.maxHints - this.hintsUsed})`;
            if (this.hintsUsed >= this.maxHints) {
                hintBtn.disabled = true;
            }
        }
    }
    
    // アンドゥ/リドゥ機能
    saveMove(move) {
        if (this.moveHistory.length >= this.maxHistorySize) {
            this.moveHistory.shift();
        }
        this.moveHistory.push(move);
        this.redoHistory = [];
        this.updateUndoRedoButtons();
    }
    
    undo() {
        if (this.moveHistory.length === 0 || this.gameOver || this.isReplaying) return;
        
        const move = this.moveHistory.pop();
        this.redoHistory.push(move);
        
        // 移動を元に戻す
        this.applyMove(move, true);
        this.updateUndoRedoButtons();
        
        if (this.soundEnabled) this.playSound('undo');
    }
    
    redo() {
        if (this.redoHistory.length === 0 || this.gameOver || this.isReplaying) return;
        
        const move = this.redoHistory.pop();
        this.moveHistory.push(move);
        
        // 移動を再適用
        this.applyMove(move, false);
        this.updateUndoRedoButtons();
        
        if (this.soundEnabled) this.playSound('redo');
    }
    
    applyMove(move, isUndo) {
        // 移動の適用/取り消しロジック
        // この実装は簡略化されており、実際にはより複雑になります
        const { type, row, col, previousState } = move;
        
        if (type === 'reveal') {
            if (isUndo) {
                this.revealed[row][col] = false;
                const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                if (cell) {
                    cell.classList.remove('revealed');
                    cell.textContent = '';
                }
            } else {
                this.revealCell(row, col);
            }
        } else if (type === 'flag') {
            this.toggleFlag(row, col);
        }
    }
    
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (undoBtn) {
            undoBtn.disabled = this.moveHistory.length === 0;
        }
        if (redoBtn) {
            redoBtn.disabled = this.redoHistory.length === 0;
        }
    }
    
    // リプレイ機能
    startRecording() {
        this.isRecording = true;
        this.replayData = [];
    }
    
    stopRecording() {
        this.isRecording = false;
    }
    
    recordAction(action) {
        if (this.isRecording && !this.isReplaying) {
            this.replayData.push({
                ...action,
                timestamp: Date.now(),
                timer: this.timer
            });
        }
    }
    
    toggleReplay() {
        if (this.isReplaying) {
            this.stopReplay();
        } else {
            this.startReplay();
        }
    }
    
    startReplay() {
        if (this.replayData.length === 0) return;
        
        this.isReplaying = true;
        this.newGame();
        
        let index = 0;
        const replayInterval = setInterval(() => {
            if (index >= this.replayData.length || !this.isReplaying) {
                clearInterval(replayInterval);
                this.isReplaying = false;
                return;
            }
            
            const action = this.replayData[index];
            this.applyReplayAction(action);
            index++;
        }, 500);
        
        const replayBtn = document.getElementById('replay-btn');
        if (replayBtn) {
            replayBtn.textContent = '⏸ 停止';
        }
    }
    
    stopReplay() {
        this.isReplaying = false;
        const replayBtn = document.getElementById('replay-btn');
        if (replayBtn) {
            replayBtn.textContent = '▶ リプレイ';
        }
    }
    
    applyReplayAction(action) {
        // リプレイアクションの適用
        if (action.type === 'reveal') {
            this.revealCell(action.row, action.col);
        } else if (action.type === 'flag') {
            this.toggleFlag(action.row, action.col);
        }
    }
    
    // チャレンジモード
    showChallengeMenu() {
        const modal = document.getElementById('challenge-modal');
        if (!modal) return;
        
        const content = document.getElementById('challenge-content');
        if (content) {
            content.innerHTML = `
                <h2>チャレンジモード</h2>
                <div class="challenge-options">
                    <button id="daily-challenge-btn">🗓 デイリーチャレンジ</button>
                    <button id="time-attack-btn">⏱ タイムアタック</button>
                    <button id="no-flag-btn">🚫 ノーフラグモード</button>
                    <button id="speed-run-btn">🏃 スピードラン</button>
                </div>
                <button id="close-challenge-btn">閉じる</button>
            `;
            
            // イベントリスナーを追加（setTimeoutを使用して確実にDOMが更新された後に追加）
            setTimeout(() => {
                const dailyBtn = document.getElementById('daily-challenge-btn');
                const timeBtn = document.getElementById('time-attack-btn');
                const noFlagBtn = document.getElementById('no-flag-btn');
                const speedBtn = document.getElementById('speed-run-btn');
                const closeBtn = document.getElementById('close-challenge-btn');
                
                if (dailyBtn) dailyBtn.addEventListener('click', () => this.startDailyChallenge());
                if (timeBtn) timeBtn.addEventListener('click', () => this.startTimeAttack());
                if (noFlagBtn) noFlagBtn.addEventListener('click', () => this.startNoFlagMode());
                if (speedBtn) speedBtn.addEventListener('click', () => this.startSpeedRun());
                if (closeBtn) closeBtn.addEventListener('click', () => this.closeChallengeModal());
            }, 0);
        }
        
        modal.classList.add('show');
    }
    
    closeChallengeModal() {
        const modal = document.getElementById('challenge-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    startDailyChallenge() {
        // 日付ベースのシード生成
        const today = new Date();
        const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
        this.dailyChallengeSeed = seed;
        this.challengeMode = 'daily';
        
        // シードを使用してボードを生成
        this.newGameWithSeed(seed);
        this.closeChallengeModal();
        
        if (this.soundEnabled) this.playSound('challenge');
    }
    
    startTimeAttack() {
        this.challengeMode = 'timeattack';
        this.newGame();
        this.closeChallengeModal();
        
        // タイムアタック用のタイマー表示
        this.showTimeAttackTimer();
    }
    
    startNoFlagMode() {
        this.challengeMode = 'noflag';
        this.newGame();
        
        // 旗ボタンを無効化
        const flagBtn = document.getElementById('flag-mode-btn');
        if (flagBtn) {
            flagBtn.disabled = true;
        }
        
        this.closeChallengeModal();
    }
    
    startSpeedRun() {
        this.challengeMode = 'speedrun';
        this.currentDifficulty = 'easy';
        this.speedRunStage = 1;
        this.speedRunTotalTime = 0;
        this.newGame();
        this.closeChallengeModal();
    }
    
    newGameWithSeed(seed) {
        // シードを使用した疑似乱数生成
        let random = seed;
        const pseudoRandom = () => {
            random = (random * 9301 + 49297) % 233280;
            return random / 233280;
        };
        
        // 通常のnewGameロジックをシード付きで実行
        this.stopTimer();
        this.timer = 0;
        this.updateTimer();
        this.gameOver = false;
        this.gameWon = false;
        this.firstClick = true;
        
        const difficulty = this.difficulties[this.currentDifficulty];
        this.initBoard(difficulty.rows, difficulty.cols, difficulty.mines);
        
        // シードを使用して地雷を配置
        // （実際の実装では、firstClickを考慮する必要があります）
        
        this.renderBoard();
        this.updateMineCount();
    }
    
    // サウンド機能
    initSounds() {
        // Web Audio APIを使用した簡単なサウンド生成
        if (window.AudioContext || window.webkitAudioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    
    playSound(type) {
        if (!this.soundEnabled || !this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        switch(type) {
            case 'reveal':
                oscillator.frequency.value = 600;
                gainNode.gain.value = 0.1;
                break;
            case 'flag':
                oscillator.frequency.value = 800;
                gainNode.gain.value = 0.1;
                break;
            case 'win':
                oscillator.frequency.value = 1000;
                gainNode.gain.value = 0.2;
                break;
            case 'lose':
                oscillator.frequency.value = 200;
                gainNode.gain.value = 0.2;
                break;
            case 'hint':
                oscillator.frequency.value = 700;
                gainNode.gain.value = 0.15;
                break;
            case 'undo':
                oscillator.frequency.value = 500;
                gainNode.gain.value = 0.1;
                break;
            case 'challenge':
                oscillator.frequency.value = 900;
                gainNode.gain.value = 0.2;
                break;
        }
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.textContent = this.soundEnabled ? '🔊' : '🔇';
        }
        localStorage.setItem('minesweeper-pro-sound', this.soundEnabled);
    }
    
    // テーマ機能
    applyTheme(themeName) {
        if (!this.customThemes[themeName]) return;
        
        this.currentTheme = themeName;
        const theme = this.customThemes[themeName];
        
        document.documentElement.style.setProperty('--theme-primary', theme.primary);
        document.documentElement.style.setProperty('--theme-secondary', theme.secondary);
        
        localStorage.setItem('minesweeper-pro-theme', themeName);
    }
    
    // 補助機能の視覚表示設定切り替え
    toggleAssistVisual() {
        this.assistVisualEnabled = !this.assistVisualEnabled;
        const assistVisualToggleBtn = document.getElementById('assist-visual-toggle-btn');
        if (assistVisualToggleBtn) {
            const textElement = assistVisualToggleBtn.querySelector('.assist-visual-text');
            if (textElement) {
                textElement.textContent = this.assistVisualEnabled ? 'ON' : 'OFF';
            }
        }
        localStorage.setItem('minesweeper-pro-assist-visual', this.assistVisualEnabled);
        
        // 補助モードが有効な場合は再表示
        if (this.assistMode) {
            this.calculateAndDisplayAssist();
        }
    }
    
    // 設定の保存と読み込み
    loadSettings() {
        // サウンド設定
        const soundSetting = localStorage.getItem('minesweeper-pro-sound');
        if (soundSetting === 'true') {
            this.soundEnabled = true;
            const soundToggle = document.getElementById('sound-toggle');
            if (soundToggle) {
                soundToggle.textContent = '🔊';
            }
        }
        
        // テーマ設定
        const themeSetting = localStorage.getItem('minesweeper-pro-theme');
        if (themeSetting && this.customThemes[themeSetting]) {
            this.applyTheme(themeSetting);
            const themeSelect = document.getElementById('theme-select');
            if (themeSelect) {
                themeSelect.value = themeSetting;
            }
        }
        
        // 補助機能の視覚表示設定
        const assistVisualSetting = localStorage.getItem('minesweeper-pro-assist-visual');
        if (assistVisualSetting === 'false') {
            this.assistVisualEnabled = false;
            const assistVisualToggleBtn = document.getElementById('assist-visual-toggle-btn');
            if (assistVisualToggleBtn) {
                const textElement = assistVisualToggleBtn.querySelector('.assist-visual-text');
                if (textElement) {
                    textElement.textContent = 'OFF';
                }
            }
        }
    }
    
    // オーバーライドメソッド
    revealCell(row, col) {
        const wasRevealed = this.revealed[row][col];
        super.revealCell(row, col);
        
        if (!wasRevealed && this.revealed[row][col]) {
            // アクションを記録
            this.recordAction({
                type: 'reveal',
                row: row,
                col: col
            });
            
            // 移動を保存
            this.saveMove({
                type: 'reveal',
                row: row,
                col: col,
                previousState: { revealed: wasRevealed }
            });
            
            if (this.soundEnabled) this.playSound('reveal');
        }
    }
    
    toggleFlag(row, col) {
        const wasFlagged = this.flagged[row][col];
        super.toggleFlag(row, col);
        
        // アクションを記録
        this.recordAction({
            type: 'flag',
            row: row,
            col: col
        });
        
        // 移動を保存
        this.saveMove({
            type: 'flag',
            row: row,
            col: col,
            previousState: { flagged: wasFlagged }
        });
        
        if (this.soundEnabled && this.flagged[row][col]) {
            this.playSound('flag');
        }
    }
    
    onGameOver() {
        super.onGameOver();
        this.updateStatistics(false);
        this.stopRecording();
        if (this.soundEnabled) this.playSound('lose');
    }
    
    onGameWon() {
        super.onGameWon();
        this.updateStatistics(true);
        this.stopRecording();
        if (this.soundEnabled) this.playSound('win');
        
        // スピードランモードの処理
        if (this.challengeMode === 'speedrun') {
            this.speedRunTotalTime += this.timer;
            this.speedRunStage++;
            
            if (this.speedRunStage <= 3) {
                // 次のステージへ
                const difficulties = ['easy', 'medium', 'hard'];
                this.currentDifficulty = difficulties[this.speedRunStage - 1];
                setTimeout(() => this.newGame(), 2000);
            } else {
                // スピードラン完了
                this.showSpeedRunComplete();
            }
        }
    }
    
    showSpeedRunComplete() {
        const modal = document.getElementById('speedrun-complete-modal');
        if (!modal) return;
        
        const minutes = Math.floor(this.speedRunTotalTime / 60);
        const seconds = this.speedRunTotalTime % 60;
        const timeStr = `${minutes}分${seconds}秒`;
        
        const content = document.getElementById('speedrun-content');
        if (content) {
            content.innerHTML = `
                <h2>スピードラン完了！</h2>
                <p>総合タイム: ${timeStr}</p>
                <button id="close-speedrun-btn">閉じる</button>
            `;
            
            // イベントリスナーを追加
            document.getElementById('close-speedrun-btn')?.addEventListener('click', () => this.closeSpeedRunModal());
        }
        
        modal.classList.add('show');
    }
    
    closeSpeedRunModal() {
        const modal = document.getElementById('speedrun-complete-modal');
        if (modal) {
            modal.classList.remove('show');
        }
        this.challengeMode = null;
    }
    
    newGame() {
        // 現在のモード状態を保存
        const probabilityModeState = this.probabilityMode;
        const assistModeState = this.assistMode;
        
        // リセット
        this.hintsUsed = 0;
        this.moveHistory = [];
        this.redoHistory = [];
        this.updateHintButton();
        this.updateUndoRedoButtons();
        
        // 確率表示をクリア
        this.clearProbabilityDisplay();
        
        // 補助表示をクリア  
        this.clearAssistDisplay();
        
        // CSPソルバーの永続確率をクリア
        if (this.cspSolver) {
            this.cspSolver.persistentProbabilities = [];
            console.log('[DEBUG] Cleared persistent probabilities on game reset');
        }
        
        // 録画開始
        this.startRecording();
        
        // 基本的なnewGame処理
        super.newGame();
        
        // モード状態を復元
        if (probabilityModeState) {
            this.probabilityMode = true;
            const probabilityBtn = document.getElementById('probability-btn');
            const boardElement = document.getElementById('game-board');
            if (probabilityBtn) probabilityBtn.classList.add('active');
            if (boardElement) boardElement.classList.add('probability-mode');
        }
        
        if (assistModeState) {
            this.assistMode = true;
            const assistBtn = document.getElementById('assist-btn');
            const boardElement = document.getElementById('game-board');
            if (assistBtn) assistBtn.classList.add('active');
            if (boardElement) boardElement.classList.add('assist-mode');
        }
    }
    
    // CSPソルバー関連メソッド
    initCSPSolver() {
        if (typeof CSPSolver !== 'undefined') {
            this.cspSolver = new CSPSolver(this);
        }
    }
    
    
    toggleProbabilityMode() {
        this.probabilityMode = !this.probabilityMode;
        const btn = document.getElementById('probability-btn');
        const boardElement = document.getElementById('game-board');
        
        if (this.probabilityMode) {
            btn.classList.add('active');
            boardElement.classList.add('probability-mode');
            this.calculateAndDisplayProbabilities();
        } else {
            btn.classList.remove('active');
            boardElement.classList.remove('probability-mode');
            this.clearProbabilityDisplay();
        }
    }
    
    toggleAssistMode() {
        this.assistMode = !this.assistMode;
        const btn = document.getElementById('assist-btn');
        const boardElement = document.getElementById('game-board');
        
        if (this.assistMode) {
            btn.classList.add('active');
            boardElement.classList.add('assist-mode');
            this.calculateAndDisplayAssist();
        } else {
            btn.classList.remove('active');
            boardElement.classList.remove('assist-mode');
            this.clearAssistDisplay();
        }
    }
    

    calculateAndDisplayAssist() {
        if (!this.cspSolver) return;
        
        // 計算中インジケーターを表示
        this.showCalculatingIndicator();
        
        // 非同期で計算を実行
        setTimeout(() => {
            const result = this.cspSolver.calculateProbabilities();
            // 永続確率と通常確率をマージして表示用の確率を作成
            const displayProbabilities = this.mergeWithPersistentProbabilities(result.probabilities);
            this.displayAssist(displayProbabilities);
            this.hideCalculatingIndicator();
        }, 10);
    }
    
    // 永続確率と通常確率をマージ（永続確率を優先）
    mergeWithPersistentProbabilities(probabilities) {
        const merged = [];
        for (let row = 0; row < this.rows; row++) {
            merged[row] = [];
            for (let col = 0; col < this.cols; col++) {
                // 永続確率があればそれを使用、なければ通常確率を使用
                if (this.cspSolver.persistentProbabilities && 
                    this.cspSolver.persistentProbabilities[row] && 
                    (this.cspSolver.persistentProbabilities[row][col] === 0 || 
                     this.cspSolver.persistentProbabilities[row][col] === 100)) {
                    merged[row][col] = this.cspSolver.persistentProbabilities[row][col];
                } else {
                    merged[row][col] = probabilities[row][col];
                }
            }
        }
        return merged;
    }
    
    displayAssist(probabilities) {
        // 視覚表示が無効な場合は色付け・アルファベット表示を行わない
        if (!this.assistVisualEnabled) {
            // ポップアップ表示のみ行う
            this.showAssistPopup(probabilities);
            return;
        }
        
        // 確率モードが有効な場合は地雷候補マスの追加表示のみ行う
        if (this.probabilityMode) {
            // 地雷候補マスのみ追加表示（確率表示は維持）
            for (let row = 0; row < this.rows; row++) {
                for (let col = 0; col < this.cols; col++) {
                    // 開示済みまたは旗付きのセルはスキップ
                    if (this.revealed[row][col] || this.flagged[row][col]) {
                        continue;
                    }

                    const probability = probabilities[row][col];
                    if (probability === -5) {
                        // 地雷候補マス：アルファベットIDがある場合のみ追加表示
                        const alphabetIds = this.cspSolver ? this.cspSolver.getAlphabetIdsForCell(row, col) : null;
                        if (alphabetIds) {
                            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                            if (cell) {
                                cell.classList.add('mine-candidate');
                                // アルファベットオーバーレイが既に存在するかチェック
                                const existingAlphabetOverlay = cell.querySelector('.mine-candidate-overlay');
                                if (!existingAlphabetOverlay) {
                                    const alphabetOverlay = document.createElement('div');
                                    alphabetOverlay.className = 'probability-overlay mine-candidate-overlay';
                                    alphabetOverlay.textContent = alphabetIds.charAt(0);
                                    alphabetOverlay.style.position = 'absolute';
                                    alphabetOverlay.style.bottom = '2px';
                                    alphabetOverlay.style.right = '2px';
                                    alphabetOverlay.style.fontSize = '10px';
                                    alphabetOverlay.style.color = 'white';
                                    alphabetOverlay.style.fontWeight = 'bold';
                                    cell.appendChild(alphabetOverlay);
                                }
                            }
                        }
                    }
                }
            }
        } else {
            // 補助モード単体時：アルファベット付きマスのみ表示
            for (let row = 0; row < this.rows; row++) {
                for (let col = 0; col < this.cols; col++) {
                    // 開示済みまたは旗付きのセルはスキップ
                    if (this.revealed[row][col] || this.flagged[row][col]) {
                        continue;
                    }

                    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    if (!cell) continue;

                    // 既存のオーバーレイをクリア
                    const existingOverlay = cell.querySelector('.probability-overlay');
                    if (existingOverlay) {
                        existingOverlay.remove();
                    }

                    // アシストクラスをクリア
                    cell.classList.remove('probability-safe', 'probability-low', 
                                        'probability-medium', 'probability-high', 'probability-certain',
                                        'probability-unknown', 'probability-interrupted',
                                        'mine-candidate');

                    const probability = probabilities[row][col];

                    if (probability === -5) {
                        // 地雷候補マス：アルファベットIDがある場合のみ表示
                        const alphabetIds = this.cspSolver ? this.cspSolver.getAlphabetIdsForCell(row, col) : null;
                        if (alphabetIds) {
                            cell.classList.add('mine-candidate');
                            const overlay = document.createElement('div');
                            overlay.className = 'probability-overlay mine-candidate-overlay';
                            overlay.textContent = alphabetIds.charAt(0);
                            cell.appendChild(overlay);
                        }
                    }
                }
            }
        }
        
        // ポップアップ表示のための処理
        this.showAssistPopup(probabilities);
    }
    
    clearAssistDisplay() {
        let display = document.querySelector('.assist-display');
        if (!display) {
            display = document.createElement('div');
            display.className = 'assist-display';
            const container = document.querySelector('.assist-display-container');
            if (container) {
                container.appendChild(display);
            } else {
                document.body.appendChild(display);
            }
        }
        
        let statusText = '';
        
        if (minProbability === 101) {
            // 確率が計算できない場合は表示しない
            display.classList.remove('show');
            return;
        } else {
            statusText = `${minProbability}%`;
            // 盤面上に100%のセルがある場合は💣を追加
            if (hasCertainMine) {
                statusText += ' 💣';
            }
        }
        
        display.innerHTML = `
            <div class="assist-content ${assistClass}">
                <span class="assist-text">${statusText}</span>
            </div>
        `;
        display.classList.add('show');
    }
    
    clearAssistDisplay() {
        // 補助表示を非表示
        const display = document.querySelector('.assist-display');
        if (display) {
            display.classList.remove('show');
        }
        
        // 視覚表示が無効な場合は色付け・アルファベット表示のクリアは不要
        if (!this.assistVisualEnabled) {
            return;
        }
        
        // 確率モードが有効な場合は補助機能の追加表示のみクリア
        if (this.probabilityMode) {
            // 地雷候補の色付けと小さなアルファベットのみクリア
            const cells = document.querySelectorAll('.cell');
            cells.forEach(cell => {
                // アルファベットオーバーレイのみ削除
                const alphabetOverlay = cell.querySelector('.mine-candidate-overlay');
                if (alphabetOverlay) {
                    alphabetOverlay.remove();
                }
                // 地雷候補の色付けのみ削除
                cell.classList.remove('mine-candidate');
            });
        } else {
            // 補助モード単体時は全ての表示をクリア
            const cells = document.querySelectorAll('.cell');
            cells.forEach(cell => {
                const overlay = cell.querySelector('.probability-overlay');
                if (overlay) {
                    overlay.remove();
                }
                cell.classList.remove('probability-safe', 'probability-low', 
                                    'probability-medium', 'probability-high', 'probability-certain',
                                    'probability-unknown', 'probability-interrupted', 'probability-skipped',
                                    'mine-candidate');
            });
        }
    }
    
    showAssistPopup(probabilities) {
        // 優先順位: 0% > 100% > その他の最低確率
        let hasSafeCell = false; // 0%のセルがあるか
        let hasUnflaggedCertainMine = false; // 旗が立っていない100%のセルがあるか
        let hasSkippedCells = false; // 完全探索がスキップされたセルがあるか
        let minProbability = 101; // その他の確率の最小値（100%より大きい値で初期化）
        let displayProbability = 101; // 実際に表示する確率
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                // 開示済みのセルはスキップ
                if (this.revealed[row][col]) {
                    continue;
                }
                
                const probability = probabilities[row][col];
                
                // 旗付きのセルはスキップ（最低確率の計算から除外）
                if (this.flagged[row][col]) {
                    continue;
                }
                
                // 完全探索がスキップされたセルをチェック
                if (probability === -4) {
                    hasSkippedCells = true;
                }
                
                // 制約ベースの確率のみ考慮（-2は平均確率なので無視）
                if (probability >= 0) {
                    // 0%のセルをチェック（最優先）
                    if (probability === 0) {
                        hasSafeCell = true;
                    }
                    // 旗が立っていない100%のセルをチェック（2番目の優先度）
                    else if (probability === 100 && !this.flagged[row][col]) {
                        hasUnflaggedCertainMine = true;
                    }
                    // その他の確率の最小値を更新
                    else if (probability < minProbability) {
                        minProbability = probability;
                    }
                }
            }
        }
        
        // 表示する確率を決定（優先順位順）
        if (hasSafeCell) {
            displayProbability = 0;
        } else if (hasUnflaggedCertainMine) {
            displayProbability = 100;
        } else if (minProbability <= 100) {
            displayProbability = minProbability;
        }
        
        // ポップアップに表示
        this.updateAssistDisplay(displayProbability, hasUnflaggedCertainMine, hasSkippedCells);
    }
    
    updateAssistDisplay(displayProbability, hasCertainMine, hasSkippedCells = false) {
        let display = document.querySelector('.assist-display');
        
        if (!display) {
            display = document.createElement('div');
            display.className = 'assist-display';
            
            const container = document.querySelector('.global-stats-display-container');
            if (container) {
                container.appendChild(display);
            } else {
                document.body.appendChild(display);
            }
        }
        
        let statusText = '';
        let assistClass = '';
        
        if (displayProbability === 101) {
            // 確率が計算できない場合
            if (hasSkippedCells) {
                // スキップされたセルがある場合は「組み合わせ超過」のみ表示
                statusText = '組み合わせ超過';
                assistClass = 'probability';
            } else {
                // スキップされたセルもない場合は表示しない
                display.classList.remove('show');
                return;
            }
        } else if (displayProbability === 0) {
            statusText = '0%';
            assistClass = 'safe';
        } else if (displayProbability === 100) {
            statusText = '100%';
            assistClass = 'mine';
            if (hasCertainMine) {
                statusText += ' 💣';
            }
        } else {
            statusText = `${displayProbability}%`;
            assistClass = 'probability';
        }
        
        // 完全探索がスキップされたセルがある場合は追加表示
        if (hasSkippedCells) {
            statusText += ' 組み合わせ超過';
        }
        
        display.innerHTML = `
            <div class="assist-content ${assistClass}">
                <span class="assist-text">${statusText}</span>
            </div>
        `;
        display.classList.add('show');
    }
    
    calculateAndDisplayProbabilities() {
        if (!this.cspSolver) return;
        
        // 計算中インジケーターを表示
        this.showCalculatingIndicator();
        
        // 非同期で計算を実行
        setTimeout(() => {
            const result = this.cspSolver.calculateProbabilities();
            // 永続確率と通常確率をマージして表示用の確率を作成
            const displayProbabilities = this.mergeWithPersistentProbabilities(result.probabilities);
            this.displayProbabilities(displayProbabilities, result.globalProbability);
            this.hideCalculatingIndicator();
        }, 10);
    }
    
    displayProbabilities(probabilities, globalProbability) {
        // 全体確率を表示
        this.updateGlobalProbabilityDisplay(globalProbability);
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                if (!cell) continue;
                
                // 既存の確率表示を削除
                const existingOverlay = cell.querySelector('.probability-overlay');
                if (existingOverlay) {
                    existingOverlay.remove();
                }
                
                // 確率クラスをクリア
                cell.classList.remove('probability-safe', 'probability-low', 
                                    'probability-medium', 'probability-high', 'probability-certain',
                                    'probability-unknown', 'probability-interrupted', 'probability-skipped',
                                    'mine-candidate');
                
                const probability = probabilities[row][col];
                
                // 開示済みまたは旗付きのセルはスキップ
                if (this.revealed[row][col] || this.flagged[row][col]) {
                    continue;
                }
                
                if (probability >= 0) {
                    // 制約ベースで計算された確率
                    const overlay = document.createElement('div');
                    overlay.className = 'probability-overlay';
                    
                    // 近似機能は廃止済み
                    overlay.textContent = `${probability}%`;
                    
                    // 確率に応じてクラスを設定
                    if (probability === 0) {
                        cell.classList.add('probability-safe');
                    } else if (probability <= 25) {
                        cell.classList.add('probability-low');
                    } else if (probability <= 50) {
                        cell.classList.add('probability-medium');
                    } else if (probability < 100) {
                        cell.classList.add('probability-high');
                    } else {
                        cell.classList.add('probability-certain');
                    }
                    
                    // 近似機能は廃止済み
                    
                    cell.appendChild(overlay);
                } else if (probability === -2) {
                    // 制約外のセル（全体確率を適用）
                    cell.classList.add('probability-unknown');
                    // 確率は表示しない（全体確率を別途表示）
                } else if (probability === -3) {
                    // 計算中断のセル
                    cell.classList.add('probability-interrupted');
                    const overlay = document.createElement('div');
                    overlay.className = 'probability-overlay';
                    overlay.textContent = '---';
                    cell.appendChild(overlay);
                } else if (probability === -4) {
                    // 完全探索スキップのセル
                    cell.classList.add('probability-skipped');
                    const overlay = document.createElement('div');
                    overlay.className = 'probability-overlay';
                    overlay.textContent = '----';
                    cell.appendChild(overlay);
                } else if (probability === 0) {
                    // 確定安全マス（0%）
                    if (this.assistMode) {
                        // 補助モード時：アルファベット表示のみ
                        const alphabetId = this.cspSolver ? this.cspSolver.getAlphabetIdForCell(row, col) : null;
                        if (alphabetId) {
                            cell.classList.add('probability-safe');
                            const overlay = document.createElement('div');
                            overlay.className = 'probability-overlay';
                            overlay.textContent = `0% ${alphabetId}`;
                            cell.appendChild(overlay);
                        }
                    } else {
                        // 確率モード時：通常の0%表示
                        cell.classList.add('probability-safe');
                        const overlay = document.createElement('div');
                        overlay.className = 'probability-overlay';
                        overlay.textContent = '0%';
                        cell.appendChild(overlay);
                    }
                } else if (probability === -5) {
                    // 地雷候補マス（補助モード時かつ視覚表示有効時のみ表示）
                    if (this.assistMode && this.assistVisualEnabled) {
                        const alphabetIds = this.cspSolver ? this.cspSolver.getAlphabetIdsForCell(row, col) : null;
                        if (alphabetIds) {
                            cell.classList.add('mine-candidate');
                            const overlay = document.createElement('div');
                            overlay.className = 'probability-overlay mine-candidate-overlay';
                            overlay.textContent = alphabetIds.charAt(0); // 最初の文字のみ表示
                            cell.appendChild(overlay);
                        }
                    }
                }
            }
        }
    }
    
    clearProbabilityDisplay() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            // 補助機能が有効かつ視覚表示有効な場合はアルファベットオーバーレイを保持
            if (this.assistMode && this.assistVisualEnabled) {
                // 確率オーバーレイのみ削除（アルファベットオーバーレイは保持）
                const overlays = cell.querySelectorAll('.probability-overlay');
                overlays.forEach(overlay => {
                    if (!overlay.classList.contains('mine-candidate-overlay')) {
                        overlay.remove();
                    }
                });
                // 確率関連のクラスのみ削除（mine-candidateは保持）
                cell.classList.remove('probability-safe', 'probability-low', 
                                    'probability-medium', 'probability-high', 'probability-certain',
                                    'probability-unknown', 'probability-interrupted', 'probability-skipped',
                                    'probability-approximate');
            } else {
                // 補助機能が無効または視覚表示無効な場合は全て削除
                const overlay = cell.querySelector('.probability-overlay');
                if (overlay) {
                    overlay.remove();
                }
                cell.classList.remove('probability-safe', 'probability-low', 
                                    'probability-medium', 'probability-high', 'probability-certain',
                                    'probability-unknown', 'probability-interrupted', 'probability-skipped',
                                    'mine-candidate');
            }
        });
        
        // 全体確率表示をクリア
        this.hideGlobalProbabilityDisplay();
    }
    
    showCalculatingIndicator() {
        // 計算中インジケーターは表示しない
        return;
    }
    
    hideCalculatingIndicator() {
        // 計算中インジケーターは表示しない
        return;
    }
    
    updateGlobalProbabilityDisplay(globalProbability) {
        const container = document.querySelector('.global-stats-display-container');
        if (!container) return;
        
        let display = container.querySelector('.global-probability-display');
        if (!display) {
            display = document.createElement('div');
            display.className = 'global-probability-display';
            container.appendChild(display);
        }
        
        const flaggedCount = this.countFlags();
        const remainingMines = this.mineCount - flaggedCount;
        const unknownCount = this.getUnknownCells().length;
        
        display.innerHTML = `
            <div class="global-prob-content">
                <div class="global-prob-value">平均確率: ${globalProbability}%</div>
            </div>
        `;
        display.classList.add('show');
    }
    
    hideGlobalProbabilityDisplay() {
        const display = document.querySelector('.global-stats-display-container .global-probability-display');
        if (display) {
            display.classList.remove('show');
        }
    }
    
    // ヘルパーメソッド
    countFlags() {
        let count = 0;
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.flagged[row][col]) count++;
            }
        }
        return count;
    }
    
    getUnknownCells() {
        const cells = [];
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (!this.revealed[row][col] && !this.flagged[row][col]) {
                    cells.push({ row, col });
                }
            }
        }
        return cells;
    }
    
    // オーバーライド: セルが更新されたら確率を再計算
    revealCell(row, col) {
        // 既に開いているセルの場合は何もしない
        if (!this.isValidCell(row, col) || this.revealed[row][col] || 
            this.gameOver || this.gameWon) {
            return;
        }
        
        // 再帰的な開示処理中またはchord操作中は確率計算を延期
        const wasRevealing = this.isRevealing || this.isChording;
        if (!wasRevealing) {
            this.isRevealing = true;
            this.revealedCellsCount = 0;  // 開いたセル数をカウント
            this.revealedCells = [];  // 開いたセルの座標を記録
        }
        
        const wasRevealed = this.revealed[row][col];
        const previousBoard = this.board[row][col];
        super.revealCell(row, col);
        
        // 爆弾を開いた場合は確率計算を行わずに終了
        if (this.gameOver) {
            if (!wasRevealing) {
                this.isRevealing = false;
                this.revealedCellsCount = 0;
                this.revealedCells = [];
            }
            return;
        }
        
        // 新しくセルが開いた場合
        if (!wasRevealed && this.revealed[row][col]) {
            this.revealedCellsCount++;
            this.revealedCells.push({row, col});
        }
        
        // 最初の呼び出しの場合のみ確率を再計算
        if (!wasRevealing && !this.isChording) {
            this.isRevealing = false;
            
            // 大きく開けた場合でも制約伝播は実行（完全探索は20マス制限で自動的に制御される）
            if (this.probabilityMode) {
                this.calculateAndDisplayProbabilities();
            }
            if (this.assistMode) {
                this.calculateAndDisplayAssist();
            }
            
            this.revealedCellsCount = 0;  // カウントをリセット
            this.revealedCells = [];  // 座標リストをリセット
        }
    }
    
    // 指定されたセルの周囲の確率表示をクリア
    clearProbabilitiesAroundCells(cells) {
        const clearedCells = new Set();
        
        for (const {row, col} of cells) {
            // 開いたセル自体とその周囲8マスの確率表示をクリア
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    const key = `${newRow},${newCol}`;
                    
                    if (this.isValidCell(newRow, newCol) && !clearedCells.has(key)) {
                        clearedCells.add(key);
                        const cell = document.querySelector(`[data-row="${newRow}"][data-col="${newCol}"]`);
                        if (cell) {
                            const overlay = cell.querySelector('.probability-overlay');
                            if (overlay) {
                                overlay.remove();
                            }
                            cell.classList.remove('probability-safe', 'probability-low', 
                                                'probability-medium', 'probability-high', 
                                                'probability-certain', 'probability-unknown', 'probability-interrupted',
                                                'mine-candidate');
                        }
                    }
                }
            }
        }
    }
    
    // ダブルクリックで周囲のマスを開く（コード操作）
    chordReveal(row, col) {
        if (!this.revealed[row][col]) return;
        
        const mineCount = this.board[row][col];
        if (mineCount === 0) return;
        
        let flagCount = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const newRow = row + dr;
                const newCol = col + dc;
                if (this.isValidCell(newRow, newCol) && this.flagged[newRow][newCol]) {
                    flagCount++;
                }
            }
        }
        
        if (flagCount === mineCount) {
            // コード操作開始
            this.isChording = true;
            this.revealedCellsCount = 0;
            this.revealedCells = [];
            
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    if (this.isValidCell(newRow, newCol) && 
                        !this.flagged[newRow][newCol] && 
                        !this.revealed[newRow][newCol]) {
                        this.revealCell(newRow, newCol);
                    }
                }
            }
            
            // コード操作終了、一度だけ計算
            this.isChording = false;
            
            // 実際にセルが開いた場合のみ計算
            if (this.revealedCellsCount > 0) {
                // 大きく開けた場合でも制約伝播は実行（完全探索は20マス制限で自動的に制御される）
                if (this.probabilityMode) {
                    this.calculateAndDisplayProbabilities();
                }
                if (this.assistMode) {
                    this.calculateAndDisplayAssist();
                }
            }
            
            this.revealedCellsCount = 0;
            this.revealedCells = [];
        }
    }
    
    toggleFlag(row, col) {
        // 旗を外す場合の判定（旗を外す前に状態を確認）
        const isRemovingFlag = this.flagged[row][col];
        
        super.toggleFlag(row, col);
        
        // 旗を外した場合、そのセルの永続確率をクリア
        if (isRemovingFlag && this.cspSolver && this.cspSolver.persistentProbabilities) {
            if (this.cspSolver.persistentProbabilities[row] && 
                this.cspSolver.persistentProbabilities[row][col] !== undefined) {
                console.log(`[DEBUG] Clearing persistent probability for unflagged cell (${row},${col}): was ${this.cspSolver.persistentProbabilities[row][col]}%`);
                this.cspSolver.persistentProbabilities[row][col] = -1;
            }
            
            // 旗を外した場合、すべての永続確率をクリアして再計算を強制
            console.log(`[DEBUG] Flag removed - clearing all persistent probabilities to force recalculation`);
            this.cspSolver.persistentProbabilities = [];
        }
        
        // 旗を立てた/外した時に確率を再計算
        if (this.probabilityMode && this.cspSolver) {
            this.calculateAndDisplayProbabilities();
        }
        if (this.assistMode && this.cspSolver) {
            this.calculateAndDisplayAssist();
        }
    }
}

// ゲームの初期化
document.addEventListener('DOMContentLoaded', () => {
    window.game = new PCProMinesweeper();
});