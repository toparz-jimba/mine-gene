// CSP (制約充足問題) ソルバーモジュール
// マインスイーパーの地雷配置確率を計算

class CSPSolver {
    constructor(game) {
        this.game = game;
        this.probabilities = [];
        this.persistentProbabilities = []; // 0%と100%の確率を永続的に保持
        this.maxConstraintSize = 25; // 完全探索の最大サイズ
        this.maxLocalCompletenessSize = 32; // 局所制約完全性処理の最大サイズ
        this.warningThreshold = 30; // 警告を表示するセル数の閾値
        this.maxValidConfigs = 500000; // 有効な配置の最大数を増加
        this.useWebWorker = typeof Worker !== 'undefined' && window.location.protocol !== 'file:';
        this.worker = null;
        
        // グループ計算結果のキャッシュ
        this.groupCache = new Map();
        this.tempGroupCache = new Map(); // 一時保存用キャッシュ
        this.previousBoardState = null; // 前回の盤面状態
        
        // WebWorkerの初期化
        if (this.useWebWorker) {
            try {
                this.worker = new Worker('./modules/csp-worker.js');
            } catch (e) {
                console.log('WebWorker not available, using main thread');
                this.useWebWorker = false;
            }
        }
    }
    
    // 各セルの地雷確率を計算
    calculateProbabilities() {
        // パフォーマンス測定開始
        const startTime = performance.now();
        this.totalConfigurations = 0;
        this.totalExhaustiveSearches = 0;
        this.cacheHits = 0;
        this.constraintPropagationOnly = 0;
        this.localCompletenessSuccess = 0;
        this.totalCellsProcessed = 0;
        
        const rows = this.game.rows;
        const cols = this.game.cols;
        
        // 盤面の変更を検出してキャッシュを無効化
        const changes = this.detectBoardChanges();
        this.invalidateCache(changes);
        
        // 確率配列を初期化 (-1: 未計算, -2: 制約外)
        this.probabilities = Array(rows).fill(null).map(() => Array(cols).fill(-1));
        
        // 永続確率配列の初期化（初回のみ）
        if (!this.persistentProbabilities || this.persistentProbabilities.length === 0) {
            this.persistentProbabilities = Array(rows).fill(null).map(() => Array(cols).fill(-1));
        }
        
        // 統計情報を計算
        const unknownCells = this.getUnknownCells();
        const flaggedCount = this.countFlags();
        const remainingMines = this.game.mineCount - flaggedCount;
        const globalProbability = unknownCells.length > 0 
            ? Math.round((remainingMines / unknownCells.length) * 100)
            : 0;
        
        // 既に開示されたセルの確率を設定（旗は無視）
        let restoredCount = 0;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (this.game.revealed[row][col]) {
                    this.probabilities[row][col] = 0; // 開示済みは地雷確率0%
                    this.persistentProbabilities[row][col] = -1; // 開示済みセルの永続確率をクリア
                } else if (this.game.flagged[row][col]) {
                    this.probabilities[row][col] = 100; // 旗は地雷確率100%として扱う
                    this.persistentProbabilities[row][col] = -1; // 旗付きセルの永続確率をクリア
                } else if (this.persistentProbabilities[row][col] === 0 || this.persistentProbabilities[row][col] === 100) {
                    // 永続的に保存された0%または100%の確率を復元
                    this.probabilities[row][col] = this.persistentProbabilities[row][col];
                    restoredCount++;
                }
            }
        }
        
        // 開示されていない境界セルを収集
        const borderCells = this.getBorderCells();
        
        if (borderCells.length === 0) {
            // 境界セルがない場合（ゲーム開始時など）
            // すべてを制約外としてマーク
            for (const cell of unknownCells) {
                if (this.probabilities[cell.row][cell.col] === -1) {
                    this.probabilities[cell.row][cell.col] = -2;
                }
            }
            return { probabilities: this.probabilities, globalProbability };
        }
        
        // 制約グループに分割
        const constraintGroups = this.partitionIntoConstraintGroups(borderCells);
        
        // 既に盤面上に0%または100%のセルがあるかチェック
        const hasExistingActionableCell = this.checkForExistingActionableCells();
        if (hasExistingActionableCell) {
            
            // 既存の確定マスがある場合でも、キャッシュから他のグループの確率を復元
            for (const group of constraintGroups) {
                const restored = this.restoreCachedProbabilitiesForGroup(group);
                
                if (!restored) {
                    // キャッシュがない場合のみ-2（制約外）としてマーク
                    for (const cell of group) {
                        if (this.probabilities[cell.row][cell.col] === -1) {
                            this.probabilities[cell.row][cell.col] = -2;
                        }
                    }
                }
            }
        } else {
            // フェーズ1: 全グループに制約伝播のみ適用
            let foundActionableCell = false;
            
            for (let i = 0; i < constraintGroups.length; i++) {
                const group = constraintGroups[i];
                this.currentProcessingGroup = group; // 現在のグループを記録
                const hasActionable = this.applyConstraintPropagationOnly(group);
                if (hasActionable) {
                    foundActionableCell = true;
                }
            }
            
            // 確定マスが見つかった場合は終了
            if (foundActionableCell) {
                // 他のグループにキャッシュ確率を復元（あれば）
                for (let i = 0; i < constraintGroups.length; i++) {
                    const group = constraintGroups[i];
                    let hasUnprocessed = false;
                    
                    // 未処理のセルがあるかチェック
                    for (const cell of group) {
                        if (this.probabilities[cell.row][cell.col] === -1) {
                            hasUnprocessed = true;
                            break;
                        }
                    }
                    
                    if (hasUnprocessed) {
                        const restored = this.restoreCachedProbabilitiesForGroup(group);
                        
                        if (!restored) {
                            // キャッシュがない場合は-2（制約外）としてマーク
                            for (const cell of group) {
                                if (this.probabilities[cell.row][cell.col] === -1) {
                                    this.probabilities[cell.row][cell.col] = -2;
                                }
                            }
                        }
                    }
                }
            } else {
                // フェーズ2: 完全探索（確定マスが見つかるまで順次実行）
                
                let phase2ActionableFound = false;
                let phase2GroupsProcessed = 0;
                
                for (let i = 0; i < constraintGroups.length && !phase2ActionableFound; i++) {
                    const group = constraintGroups[i];
                    this.currentProcessingGroup = group; // 現在のグループを記録
                    const hasActionable = this.solveConstraintGroup(group, true); // skipConstraintPropagation = true
                    phase2GroupsProcessed++;
                    
                    if (hasActionable) {
                        phase2ActionableFound = true;
                        
                        // 地雷候補マスをマーク（Phase2でも実行）
                        this.markMineCandidatesForConfirmedSafes(group);
                        
                        // 既に処理済みのグループ（0からi-1まで）のキャッシュを復元
                        for (let j = 0; j < i; j++) {
                            const processedGroup = constraintGroups[j];
                            
                            // キャッシュから確率を復元を試行
                            const restored = this.restoreCachedProbabilitiesForGroup(processedGroup);
                            
                            if (!restored) {
                                // キャッシュがない場合は-2（制約外）としてマーク
                                for (const cell of processedGroup) {
                                    if (this.probabilities[cell.row][cell.col] === -1) {
                                        this.probabilities[cell.row][cell.col] = -2;
                                    }
                                }
                            }
                        }
                        
                        // 残りのグループにキャッシュ確率を復元（あれば）、なければ-2でマーク
                        for (let j = i + 1; j < constraintGroups.length; j++) {
                            const remainingGroup = constraintGroups[j];
                            
                            // キャッシュから確率を復元を試行
                            const restored = this.restoreCachedProbabilitiesForGroup(remainingGroup);
                            
                            if (!restored) {
                                // キャッシュがない場合は-2（制約外）としてマーク
                                for (const cell of remainingGroup) {
                                    if (this.probabilities[cell.row][cell.col] === -1) {
                                        this.probabilities[cell.row][cell.col] = -2;
                                    }
                                }
                            }
                        }
                    }
                }
                
                // 確定マスが見つからなかった場合、残りのグループにキャッシュ確率を復元
                if (!phase2ActionableFound) {
                    for (let i = phase2GroupsProcessed; i < constraintGroups.length; i++) {
                        const group = constraintGroups[i];
                        
                        // キャッシュから確率を復元を試行
                        const restored = this.restoreCachedProbabilitiesForGroup(group);
                        
                        if (!restored) {
                            // キャッシュがない場合は-2（制約外）としてマーク
                            for (const cell of group) {
                                if (this.probabilities[cell.row][cell.col] === -1) {
                                    this.probabilities[cell.row][cell.col] = -2;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // 制約で計算されなかったセルを-2でマーク
        for (const cell of unknownCells) {
            if (this.probabilities[cell.row][cell.col] === -1) {
                this.probabilities[cell.row][cell.col] = -2; // 制約外
            }
        }
        
        // パフォーマンス測定結果を出力（完全探索が実行された場合のみ）
        if (this.totalExhaustiveSearches > 0) {
            const endTime = performance.now();
            const processingTime = (endTime - startTime).toFixed(2);
            const processingTimeSeconds = (processingTime / 1000).toFixed(3);
            
            // 処理方法を判定
            let processingMethod = "";
            if (this.constraintPropagationOnly > 0) {
                processingMethod = "制約伝播";
            } else if (this.localCompletenessSuccess > 0) {
                processingMethod = "局所制約完全性";
            } else {
                processingMethod = "完全探索";
            }
            
            console.log(`┌── [PERFORMANCE REPORT] ──────────────────────────┐`);
            console.log(`│ 確率計算完了                                     │`);
            console.log(`│ 処理方法: ${processingMethod}                              │`);
            console.log(`│ 処理時間: ${processingTime}ms (${processingTimeSeconds}秒)             │`);
            console.log(`│ 計算マス数: ${this.totalCellsProcessed}マス                           │`);
            console.log(`│ 総パターン数: ${this.totalConfigurations.toLocaleString()}パターン                     │`);
            console.log(`│ 完全探索実行回数: ${this.totalExhaustiveSearches}回                        │`);
            console.log(`│ キャッシュヒット数: ${this.cacheHits}回                         │`);
            console.log(`│ パターン/秒: ${Math.round(this.totalConfigurations / (processingTime / 1000)).toLocaleString()}                            │`);
            console.log(`└──────────────────────────────────────────────────┘`);
        }
        
        // 地雷候補マスをマーク（確定安全マスに依存する場合）
        this.markMineCandidatesForConfirmedSafes(borderCells);
        
        return { probabilities: this.probabilities, globalProbability };
    }
    
    // スキップされたグループにキャッシュから確率を復元
    restoreCachedProbabilitiesForGroup(group) {
        const constraints = this.getConstraintsForGroup(group);
        const fingerprint = this.getGroupFingerprint(group, constraints);
        
        
        // まず通常のキャッシュをチェック
        if (this.groupCache.has(fingerprint)) {
            const cached = this.groupCache.get(fingerprint);
            
            // キャッシュから確率を復元
            for (const cellProb of cached.probabilities) {
                // 0%/100%以外の確率のみ復元（確定マスは永続確率で管理）
                if (cellProb.prob !== 0 && cellProb.prob !== 100) {
                    this.probabilities[cellProb.row][cellProb.col] = cellProb.prob;
                }
            }
            return true;
        }
        
        // 通常のキャッシュにない場合、一時キャッシュをチェック
        if (this.tempGroupCache.has(fingerprint)) {
            const cached = this.tempGroupCache.get(fingerprint);
            
            // キャッシュから確率を復元
            for (const cellProb of cached.probabilities) {
                // 0%/100%以外の確率のみ復元（確定マスは永続確率で管理）
                if (cellProb.prob !== 0 && cellProb.prob !== 100) {
                    this.probabilities[cellProb.row][cellProb.col] = cellProb.prob;
                }
            }
            return true;
        }
        return false;
    }
    
    // 境界セル（開示されたセルに隣接する未開示セル）を取得
    getBorderCells() {
        const borderSet = new Set();
        
        for (let row = 0; row < this.game.rows; row++) {
            for (let col = 0; col < this.game.cols; col++) {
                if (this.game.revealed[row][col] && this.game.board[row][col] > 0) {
                    // 数字セルの周囲の未開示セルを境界セルとして追加（旗も含む）
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            if (dr === 0 && dc === 0) continue;
                            const newRow = row + dr;
                            const newCol = col + dc;
                            
                            if (this.game.isValidCell(newRow, newCol) &&
                                !this.game.revealed[newRow][newCol] &&
                                !this.game.flagged[newRow][newCol]) {
                                // 旗が立っていないセルのみ境界セルとして扱う
                                borderSet.add(`${newRow},${newCol}`);
                            }
                        }
                    }
                }
            }
        }
        
        return Array.from(borderSet).map(key => {
            const [row, col] = key.split(',').map(Number);
            return { row, col };
        });
    }
    
    // 未開示のセルを取得（旗は除く）
    getUnknownCells() {
        const cells = [];
        for (let row = 0; row < this.game.rows; row++) {
            for (let col = 0; col < this.game.cols; col++) {
                if (!this.game.revealed[row][col] && !this.game.flagged[row][col]) {
                    // 旗が立っていないセルのみを未開示として扱う
                    cells.push({ row, col });
                }
            }
        }
        return cells;
    }
    
    // 制約グループに分割（連結成分を見つける）
    partitionIntoConstraintGroups(borderCells) {
        const groups = [];
        const visited = new Set();
        const borderCellsSet = new Set(borderCells.map(c => `${c.row},${c.col}`));
        
        for (const cell of borderCells) {
            const key = `${cell.row},${cell.col}`;
            if (visited.has(key)) continue;
            
            const group = [];
            const queue = [cell];
            const groupSet = new Set([key]);
            visited.add(key);
            
            while (queue.length > 0) {
                const current = queue.shift();
                group.push(current);
                
                // この境界セルに制約を与える数字セルを見つける
                const constrainingCells = this.getConstrainingCells(current);
                
                // 各制約セルから、その周りの境界セルを探す
                for (const constraining of constrainingCells) {
                    // 制約セルの周りのすべての境界セルを同じグループに追加
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            if (dr === 0 && dc === 0) continue;
                            const newRow = constraining.row + dr;
                            const newCol = constraining.col + dc;
                            const newKey = `${newRow},${newCol}`;
                            
                            // 境界セルであり、まだ訪問していない場合
                            if (borderCellsSet.has(newKey) && !groupSet.has(newKey)) {
                                visited.add(newKey);
                                groupSet.add(newKey);
                                queue.push({ row: newRow, col: newCol });
                            }
                        }
                    }
                }
            }
            
            groups.push(group);
        }
        
        return groups;
    }
    
    // 指定セルに制約を与える数字セルを取得
    getConstrainingCells(cell) {
        const constraining = [];
        
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const row = cell.row + dr;
                const col = cell.col + dc;
                
                if (this.game.isValidCell(row, col) &&
                    this.game.revealed[row][col] &&
                    this.game.board[row][col] > 0) {
                    constraining.push({ row, col, value: this.game.board[row][col] });
                }
            }
        }
        
        return constraining;
    }
    
    // 制約伝播のみを適用（完全探索なし）
    // 戻り値: true = 0%か100%のセルが見つかった, false = 見つからなかった
    applyConstraintPropagationOnly(group) {
        const constraints = this.getConstraintsForGroup(group);
        
        // 制約がない場合は何もしない
        if (constraints.length === 0) {
            return false;
        }
        
        // 制約伝播で0%と100%のセルを確定
        const determinedCells = this.determineCertainCells(group, constraints);
        
        // 確定したセルの確率を設定
        for (const cellIdx of determinedCells.certain) {
            const row = group[cellIdx].row;
            const col = group[cellIdx].col;
            this.probabilities[row][col] = 100;
            this.persistentProbabilities[row][col] = 100;
        }
        for (const cellIdx of determinedCells.safe) {
            const row = group[cellIdx].row;
            const col = group[cellIdx].col;
            this.probabilities[row][col] = 0;
            this.persistentProbabilities[row][col] = 0;
        }
        
        // 0%か100%のセルが見つかったかどうかを返す
        return (determinedCells.certain.length > 0 || determinedCells.safe.length > 0);
    }
    
    // 制約グループを完全探索で解く（キャッシュ対応版）
    // 戻り値: true = 0%か100%のセルが見つかった, false = 見つからなかった
    solveConstraintGroup(group, skipConstraintPropagation = false) {
        // 制約を取得
        const constraints = this.getConstraintsForGroup(group);
        
        // グループの指紋を生成
        const fingerprint = this.getGroupFingerprint(group, constraints);
        
        // キャッシュをチェック
        if (this.groupCache.has(fingerprint)) {
            const cached = this.groupCache.get(fingerprint);
            this.cacheHits += 1;
            
            // キャッシュから確率を復元
            for (const cellProb of cached.probabilities) {
                this.probabilities[cellProb.row][cellProb.col] = cellProb.prob;
                
                // 0%または100%の場合は永続確率も更新
                if (cellProb.prob === 0 || cellProb.prob === 100) {
                    this.persistentProbabilities[cellProb.row][cellProb.col] = cellProb.prob;
                }
            }
            
            return cached.hasActionable;
        }
        
        // 警告表示
        if (group.length > this.warningThreshold) {
            console.warn(`Large constraint group detected: ${group.length} cells. This may take some time...`);
        }
        
        
        // 完全探索で解く
        const hasActionable = this.solveExactWithConstraints(group, constraints, skipConstraintPropagation);
        
        // 結果をキャッシュに保存
        const probabilities = group.map(cell => ({
            row: cell.row,
            col: cell.col,
            prob: this.probabilities[cell.row][cell.col]
        }));
        
        this.groupCache.set(fingerprint, {
            probabilities,
            hasActionable
        });
        
        return hasActionable;
    }
    
    // 制約付きで完全探索を実行（制約を再計算しない）
    solveExactWithConstraints(group, constraints, skipConstraintPropagation = false) {
        return this.solveExact(group, skipConstraintPropagation);
    }
    
    // 局所制約完全性をチェック（セル集合が独立して解けるか判定）
    checkLocalConstraintCompleteness(cellSet, constraintSet, allConstraints) {
        const cellIndices = new Set(cellSet);
        
        // 条件1: セル集合内の各セルが関与する制約が、すべて制約集合内に含まれているか
        for (const cellIdx of cellIndices) {
            // このセルが関与するすべての制約を取得
            const cellConstraints = allConstraints.filter(constraint => 
                constraint.cells.includes(cellIdx)
            );
            
            // このセルの制約がすべて制約集合に含まれているかチェック
            for (const cellConstraint of cellConstraints) {
                if (!constraintSet.includes(cellConstraint)) {
                    return false; // 制約集合外の制約がセルに影響している
                }
            }
        }
        
        // 条件2: 制約集合内の各制約が影響するセルが、すべてセル集合内に含まれているか
        for (const constraint of constraintSet) {
            for (const cellIdx of constraint.cells) {
                if (!cellIndices.has(cellIdx)) {
                    return false; // セル集合外のセルに制約が影響している
                }
            }
        }
        
        return true; // 完全性が確認された
    }
    
    // 独立した部分集合を検出
    findIndependentSubsets(group, constraints) {
        const independentSubsets = [];
        const processedConstraints = new Set();
        
        for (const constraint of constraints) {
            if (processedConstraints.has(constraint)) continue;
            
            // この制約から開始して関連する制約とセルを収集
            const relatedConstraints = [constraint];
            const relatedCells = new Set(constraint.cells);
            const constraintQueue = [constraint];
            const processedInThisSet = new Set([constraint]);
            
            // 制約の連鎖を辿る
            while (constraintQueue.length > 0) {
                const currentConstraint = constraintQueue.shift();
                
                // この制約に関わるセルを追加
                for (const cellIdx of currentConstraint.cells) {
                    relatedCells.add(cellIdx);
                }
                
                // セルを共有する他の制約を探す
                for (const otherConstraint of constraints) {
                    if (processedInThisSet.has(otherConstraint)) continue;
                    
                    // セルの重複をチェック
                    const hasOverlap = otherConstraint.cells.some(cellIdx => 
                        relatedCells.has(cellIdx)
                    );
                    
                    if (hasOverlap) {
                        relatedConstraints.push(otherConstraint);
                        constraintQueue.push(otherConstraint);
                        processedInThisSet.add(otherConstraint);
                    }
                }
            }
            
            // 完全性をチェック
            const cellArray = Array.from(relatedCells);
            if (this.checkLocalConstraintCompleteness(cellArray, relatedConstraints, constraints)) {
                independentSubsets.push({
                    cells: cellArray,
                    constraints: relatedConstraints,
                    isComplete: true
                });
            }
            
            // 処理済みとしてマーク
            for (const processedConstraint of relatedConstraints) {
                processedConstraints.add(processedConstraint);
            }
        }
        
        return independentSubsets;
    }
    
    // 独立部分集合を完全探索で解く
    // 戻り値: true = 0%か100%のセルが見つかった, false = 見つからなかった
    solveIndependentSubset(subset, group) {
        // 部分集合のセルをグループ内インデックスから実際のセル情報に変換
        const subsetCells = subset.cells.map(idx => group[idx]);
        
        // サイズチェック（安全性のため）
        if (subsetCells.length > this.maxConstraintSize) {
            console.warn(`Independent subset too large (${subsetCells.length} cells). Skipping.`);
            return false;
        }
        
        console.log(`[LOCAL COMPLETENESS] Solving independent subset: ${subsetCells.length} cells, ${subset.constraints.length} constraints`);
        
        // 完全探索を実行
        const validConfigurations = [];
        const totalConfigs = Math.pow(2, subsetCells.length);
        
        // パフォーマンス測定用カウンター更新
        this.totalConfigurations += totalConfigs;
        this.totalExhaustiveSearches += 1;
        this.totalCellsProcessed += subsetCells.length;
        
        // すべての可能な配置を試す
        for (let config = 0; config < totalConfigs; config++) {
            const mines = [];
            for (let i = 0; i < subsetCells.length; i++) {
                if ((config >> i) & 1) {
                    mines.push(i);
                }
            }
            
            if (this.isValidConfigurationForSubset(mines, subset.constraints)) {
                validConfigurations.push(mines);
            }
        }
        
        // 有効な配置から確率を計算
        let hasActionableCell = false;
        if (validConfigurations.length > 0) {
            for (let i = 0; i < subsetCells.length; i++) {
                let mineCount = 0;
                for (const config of validConfigurations) {
                    if (config.includes(i)) {
                        mineCount++;
                    }
                }
                const probability = Math.round((mineCount / validConfigurations.length) * 100);
                const cell = subsetCells[i];
                this.probabilities[cell.row][cell.col] = probability;
                
                // 0%または100%の場合は永続的に保存
                if (probability === 0 || probability === 100) {
                    this.persistentProbabilities[cell.row][cell.col] = probability;
                    hasActionableCell = true;
                }
            }
        } else {
            // 有効な配置がない場合（エラー状態）
            console.warn('No valid configurations found for independent subset');
            for (const cell of subsetCells) {
                this.probabilities[cell.row][cell.col] = 50; // デフォルト値
            }
        }
        
        return hasActionableCell;
    }
    
    // 独立部分集合用の配置検証
    isValidConfigurationForSubset(mineIndices, constraints) {
        // 各制約をチェック
        for (const constraint of constraints) {
            let actualMines = 0;
            
            for (const cellIndex of constraint.cells) {
                if (mineIndices.includes(cellIndex)) {
                    actualMines++;
                }
            }
            
            // 必要な地雷数をチェック（旗の数は既に引かれている）
            if (actualMines !== constraint.requiredMines) {
                return false;
            }
        }
        
        return true;
    }
    
    // 確定マス以外のセルを計算中断としてマーク
    markRemainingCellsAsInterrupted(group) {
        let interruptedCount = 0;
        
        for (const cell of group) {
            const currentProb = this.probabilities[cell.row][cell.col];
            
            // 未計算(-1)、または確定マス以外の確率値の場合
            if (currentProb === -1 || (currentProb !== 0 && currentProb !== 100 && currentProb !== -2)) {
                this.probabilities[cell.row][cell.col] = -3; // 計算中断
                interruptedCount++;
            }
        }
        
        console.log(`[LOCAL COMPLETENESS] Marked ${interruptedCount} cells as calculation interrupted (-3)`);
    }
    
    // 確定安全マス（0%）の依存地雷候補をマーク
    markMineCandidatesForConfirmedSafes(group) {
        const confirmedSafeCells = [];
        const candidates = new Map(); // セル座標 → 依存するアルファベットIDセット
        
        // 確定安全マス（0%）を特定してアルファベットIDを付与
        for (const cell of group) {
            if (this.probabilities[cell.row][cell.col] === 0) {
                const alphabetId = String.fromCharCode(65 + confirmedSafeCells.length); // A, B, C...
                cell.alphabetId = alphabetId;
                confirmedSafeCells.push(cell);
            }
        }
        
        if (confirmedSafeCells.length === 0) return;
        
        console.log(`[MINE CANDIDATES] Analyzing ${confirmedSafeCells.length} confirmed safe cells with IDs: ${confirmedSafeCells.map(c => c.alphabetId).join(', ')}`);
        
        // 各確定安全セルについて依存地雷候補を特定
        for (const safeCell of confirmedSafeCells) {
            const dependencies = this.findMineDependenciesForSafeCell(safeCell, group);
            
            for (const candidateKey of dependencies) {
                if (!candidates.has(candidateKey)) {
                    candidates.set(candidateKey, new Set());
                }
                candidates.get(candidateKey).add(safeCell.alphabetId);
            }
        }
        
        // 候補マスをマーク（アルファベットIDも記録）
        for (const [candidateKey, alphabetIds] of candidates) {
            const [row, col] = candidateKey.split(',').map(Number);
            
            // 既に確率が設定されている場合はスキップ（確定マスや計算済みセル）
            const currentProb = this.probabilities[row][col];
            if (currentProb !== -1 && currentProb !== -3) continue;
            
            this.probabilities[row][col] = -5; // 統一された地雷候補
            
            // アルファベットIDを記録（グループ内の対応するセルを探して設定）
            const targetCell = group.find(c => c.row === row && c.col === col);
            if (targetCell) {
                targetCell.alphabetIds = Array.from(alphabetIds).sort().join('');
            }
        }
        
        console.log(`[MINE CANDIDATES] Marked ${candidates.size} mine candidate cells`);
    }
    
    // セルのアルファベットIDを取得（確定安全マス用）
    getAlphabetIdForCell(row, col) {
        // 現在処理中のグループからアルファベットIDを探す
        if (this.currentProcessingGroup) {
            const cell = this.currentProcessingGroup.find(c => c.row === row && c.col === col);
            return cell ? cell.alphabetId : null;
        }
        return null;
    }
    
    // セルのアルファベットIDsを取得（地雷候補マス用）
    getAlphabetIdsForCell(row, col) {
        // 現在処理中のグループからアルファベットIDsを探す
        if (this.currentProcessingGroup) {
            const cell = this.currentProcessingGroup.find(c => c.row === row && c.col === col);
            return cell ? cell.alphabetIds : null;
        }
        return null;
    }
    
    // 確定安全セルの依存地雷候補を特定
    findMineDependenciesForSafeCell(safeCell, group) {
        const dependencies = new Set();
        
        // この安全セルに隣接する数字セルを取得
        const adjacentNumberCells = this.getAdjacentNumberCells(safeCell);
        
        for (const numberCell of adjacentNumberCells) {
            const remainingMines = this.calculateRemainingMinesForNumberCell(numberCell);
            
            if (remainingMines > 0) {
                // この数字セルの周りの未開示セルが地雷候補
                const unknownNeighbors = this.getUnknownNeighborsOfNumberCell(numberCell, group);
                
                for (const neighbor of unknownNeighbors) {
                    // 安全セル自身は除外
                    if (neighbor.row !== safeCell.row || neighbor.col !== safeCell.col) {
                        dependencies.add(`${neighbor.row},${neighbor.col}`);
                    }
                }
            }
        }
        
        return dependencies;
    }
    
    // セルに隣接する数字セルを取得
    getAdjacentNumberCells(cell) {
        const numberCells = [];
        
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                
                const row = cell.row + dr;
                const col = cell.col + dc;
                
                if (this.game.isValidCell(row, col) && 
                    this.game.revealed[row][col] && 
                    this.game.board[row][col] > 0) {
                    numberCells.push({
                        row: row,
                        col: col,
                        value: this.game.board[row][col]
                    });
                }
            }
        }
        
        return numberCells;
    }
    
    // 数字セルの残り必要地雷数を計算
    calculateRemainingMinesForNumberCell(numberCell) {
        const flaggedCount = this.countFlaggedNeighbors(numberCell.row, numberCell.col);
        return numberCell.value - flaggedCount;
    }
    
    // 数字セルの周りの未開示セルを取得
    getUnknownNeighborsOfNumberCell(numberCell, group) {
        const unknownNeighbors = [];
        const groupCellSet = new Set(group.map(c => `${c.row},${c.col}`));
        
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                
                const row = numberCell.row + dr;
                const col = numberCell.col + dc;
                
                if (this.game.isValidCell(row, col) && 
                    !this.game.revealed[row][col] && 
                    !this.game.flagged[row][col] &&
                    groupCellSet.has(`${row},${col}`)) {
                    unknownNeighbors.push({ row, col });
                }
            }
        }
        
        return unknownNeighbors;
    }
    
    // 単純制約パターンをチェックして直接計算
    // 戻り値: {solved: boolean, hasActionable: boolean} または null
    checkSimpleConstraintPatterns(group, constraints) {
        const startTime = performance.now();
        
        console.log(`[DEBUG] Checking simple patterns: ${group.length} cells, ${constraints.length} constraints`);
        for (let i = 0; i < constraints.length; i++) {
            const c = constraints[i];
            console.log(`[DEBUG] Constraint ${i}: ${c.cells.length} cells, ${c.requiredMines} mines required`);
        }
        
        // パターン1: 単一制約で全セルが同等
        if (constraints.length === 1) {
            const constraint = constraints[0];
            console.log(`[DEBUG] Single constraint detected: ${constraint.cells.length} cells in group, ${constraint.cells.length} cells in constraint`);
            
            // 制約がグループ全体をカバーしているかチェック
            if (constraint.cells.length === group.length) {
                console.log(`[DEBUG] Constraint covers entire group. Proceeding with direct calculation.`);
                const result = this.solveSingleConstraintDirect(group, constraint, startTime);
                if (result) {
                    return result;
                }
            } else {
                console.log(`[DEBUG] Constraint does not cover entire group (${constraint.cells.length}/${group.length}). Skipping simple pattern.`);
            }
        }
        
        // パターン2: 複数制約だが対称性がある場合
        if (constraints.length > 1) {
            const symmetryResult = this.checkConstraintSymmetry(group, constraints, startTime);
            if (symmetryResult) {
                return symmetryResult;
            }
        }
        
        console.log(`[DEBUG] No simple pattern detected.`);
        return null; // 単純パターンではない
    }
    
    // 単一制約を直接計算
    solveSingleConstraintDirect(group, constraint, startTime) {
        const cellCount = constraint.cells.length;
        const requiredMines = constraint.requiredMines;
        
        // 制約違反チェック
        if (requiredMines < 0 || requiredMines > cellCount) {
            return null;
        }
        
        // セル数チェック（単一制約でも大きすぎる場合は通常の処理に委ねる）
        if (cellCount > this.maxConstraintSize) {
            return null;
        }
        
        // すべてのセルが制約内に含まれているかチェック
        if (constraint.cells.length !== cellCount) {
            return null;
        }
        
        // 確定パターンのチェック
        let hasActionable = false;
        let patternType = "";
        let probability = 0;
        
        if (requiredMines === 0) {
            // すべて安全
            for (const cellIdx of constraint.cells) {
                const cell = group[cellIdx];
                this.probabilities[cell.row][cell.col] = 0;
                this.persistentProbabilities[cell.row][cell.col] = 0;
            }
            hasActionable = true;
            patternType = "全セル安全";
            probability = 0;
        } else if (requiredMines === cellCount) {
            // すべて地雷
            for (const cellIdx of constraint.cells) {
                const cell = group[cellIdx];
                this.probabilities[cell.row][cell.col] = 100;
                this.persistentProbabilities[cell.row][cell.col] = 100;
            }
            hasActionable = true;
            patternType = "全セル地雷";
            probability = 100;
        } else {
            // 均等確率（数学的に正確な計算）
            probability = Math.round((requiredMines / cellCount) * 100);
            for (const cellIdx of constraint.cells) {
                const cell = group[cellIdx];
                this.probabilities[cell.row][cell.col] = probability;
                // 0%または100%の場合のみ永続保存
                if (probability === 0 || probability === 100) {
                    this.persistentProbabilities[cell.row][cell.col] = probability;
                    hasActionable = true;
                }
            }
            patternType = "均等確率";
        }
        
        // パフォーマンスレポート出力
        const endTime = performance.now();
        const processingTime = (endTime - startTime).toFixed(2);
        const processingTimeSeconds = (processingTime / 1000).toFixed(3);
        
        console.log(`┌── [SIMPLE PATTERN REPORT] ───────────────────────┐`);
        console.log(`│ 単純パターン計算完了                             │`);
        console.log(`│ パターン: ${patternType}                            │`);
        console.log(`│ 処理時間: ${processingTime}ms (${processingTimeSeconds}秒)             │`);
        console.log(`│ 計算マス数: ${cellCount}マス                           │`);
        console.log(`│ 制約: ${requiredMines}個の地雷 / ${cellCount}マス                  │`);
        console.log(`│ 結果確率: ${probability}%                            │`);
        console.log(`│ 確定マス発見: ${hasActionable ? 'あり' : 'なし'}                        │`);
        console.log(`│ 計算量削減: 完全探索 ${Math.pow(2, cellCount).toLocaleString()}パターン → 直接計算      │`);
        console.log(`└──────────────────────────────────────────────────┘`);
        
        return { solved: true, hasActionable };
    }
    
    // 制約の対称性をチェック
    checkConstraintSymmetry(group, constraints, startTime) {
        // より高度な対称性検出は後で実装
        // 今回は基本的なケースのみ対応
        
        // すべての制約が同じセル集合に対して同じ要求をしている場合
        const allCells = new Set();
        const allRequiredMines = [];
        
        for (const constraint of constraints) {
            for (const cellIdx of constraint.cells) {
                allCells.add(cellIdx);
            }
            allRequiredMines.push(constraint.requiredMines);
        }
        
        // 単純な対称性: すべての制約が同じ地雷数を要求
        const uniqueRequiredMines = [...new Set(allRequiredMines)];
        if (uniqueRequiredMines.length === 1 && allCells.size === group.length) {
            // すべてのセルが関与し、すべての制約が同じ地雷数を要求
            const totalRequiredMines = uniqueRequiredMines[0] * constraints.length;
            const cellCount = allCells.size;
            
            if (totalRequiredMines <= cellCount) {
                const probability = Math.round((totalRequiredMines / cellCount) * 100);
                let hasActionable = false;
                
                for (let i = 0; i < group.length; i++) {
                    const cell = group[i];
                    this.probabilities[cell.row][cell.col] = probability;
                    if (probability === 0 || probability === 100) {
                        this.persistentProbabilities[cell.row][cell.col] = probability;
                        hasActionable = true;
                    }
                }
                
                // パフォーマンスレポート出力
                const endTime = performance.now();
                const processingTime = (endTime - startTime).toFixed(2);
                const processingTimeSeconds = (processingTime / 1000).toFixed(3);
                
                console.log(`┌── [SIMPLE PATTERN REPORT] ───────────────────────┐`);
                console.log(`│ 単純パターン計算完了                             │`);
                console.log(`│ パターン: 対称制約                               │`);
                console.log(`│ 処理時間: ${processingTime}ms (${processingTimeSeconds}秒)             │`);
                console.log(`│ 計算マス数: ${cellCount}マス                           │`);
                console.log(`│ 制約数: ${constraints.length}個                            │`);
                console.log(`│ 結果確率: ${probability}%                            │`);
                console.log(`│ 確定マス発見: ${hasActionable ? 'あり' : 'なし'}                        │`);
                console.log(`│ 計算量削減: 完全探索 ${Math.pow(2, cellCount).toLocaleString()}パターン → 直接計算      │`);
                console.log(`└──────────────────────────────────────────────────┘`);
                
                return { solved: true, hasActionable };
            }
        }
        
        return null; // 対称性なし
    }
    
    // 完全探索による確率計算（最適化版）
    // 戻り値: true = 0%か100%のセルが見つかった, false = 見つからなかった
    solveExact(group, skipConstraintPropagation = false) {
        // まず簡単なケースを処理
        const simpleSolution = this.trySolveSingleConstraint(group);
        if (simpleSolution) {
            let hasActionableCell = false;
            for (let i = 0; i < group.length; i++) {
                if (simpleSolution[i] !== null && simpleSolution[i] !== undefined) {
                    const row = group[i].row;
                    const col = group[i].col;
                    this.probabilities[row][col] = simpleSolution[i];
                    // 0%または100%の場合は永続的に保存
                    if (simpleSolution[i] === 0 || simpleSolution[i] === 100) {
                        this.persistentProbabilities[row][col] = simpleSolution[i];
                        hasActionableCell = true;
                    }
                }
            }
            // 部分的な解決の場合は続行
            const hasUnresolved = simpleSolution.some(p => p === null || p === undefined);
            if (!hasUnresolved) {
                return hasActionableCell; // 0%/100%が見つかったかどうかを返す
            }
        }
        
        const constraints = this.getConstraintsForGroup(group);
        
        // 制約がない場合は均等確率を割り当て
        if (constraints.length === 0) {
            const remainingMines = this.game.mineCount - this.countFlags();
            const unknownCount = this.getUnknownCells().length;
            const probability = Math.min(100, Math.round((remainingMines / unknownCount) * 100));
            
            let hasActionableCell = false;
            for (const cell of group) {
                this.probabilities[cell.row][cell.col] = probability;
                if (probability === 0 || probability === 100) {
                    this.persistentProbabilities[cell.row][cell.col] = probability;
                    hasActionableCell = true;
                }
            }
            return hasActionableCell;
        }
        
        let determinedCells = { certain: [], safe: [] };
        let hasActionableFromPropagation = false;
        
        console.log(`[DEBUG] solveExact called with skipConstraintPropagation: ${skipConstraintPropagation}`);
        
        // STEP 1: 制約伝播（スキップしない場合のみ）
        if (!skipConstraintPropagation) {
            determinedCells = this.determineCertainCells(group, constraints);
            
            // デバッグ情報（大きなグループの場合のみ）
            if (group.length > this.maxConstraintSize) {
                console.log(`Constraint propagation: ${determinedCells.certain.length} mines, ${determinedCells.safe.length} safe cells confirmed`);
            }
            
            // 確定したセルの確率を設定
            for (const cellIdx of determinedCells.certain) {
                const row = group[cellIdx].row;
                const col = group[cellIdx].col;
                this.probabilities[row][col] = 100;
                this.persistentProbabilities[row][col] = 100;
            }
            for (const cellIdx of determinedCells.safe) {
                const row = group[cellIdx].row;
                const col = group[cellIdx].col;
                this.probabilities[row][col] = 0;
                this.persistentProbabilities[row][col] = 0;
            }
            
            hasActionableFromPropagation = (determinedCells.certain.length > 0 || determinedCells.safe.length > 0);
        }
        
        // STEP 2: 局所制約完全性チェック（制約伝播とは独立して実行）
        if (!hasActionableFromPropagation) {
            // グループサイズが局所制約完全性の制限内かチェック
            if (group.length <= this.maxLocalCompletenessSize) {
                console.log(`[LOCAL COMPLETENESS] Analyzing group of ${group.length} cells for independent subsets...`);
                const independentSubsets = this.findIndependentSubsets(group, constraints);
                
                if (independentSubsets.length > 0) {
                    console.log(`[LOCAL COMPLETENESS] Found ${independentSubsets.length} independent subset(s): ${independentSubsets.map(s => s.cells.length + ' cells').join(', ')}`);
                    
                    // 小さな独立部分集合があれば優先的に処理
                    for (const subset of independentSubsets) {
                        if (subset.cells.length <= this.maxConstraintSize) {
                            const hasActionableFromSubset = this.solveIndependentSubset(subset, group);
                            if (hasActionableFromSubset) {
                                console.log(`[LOCAL COMPLETENESS] Found actionable cells in independent subset of ${subset.cells.length} cells`);
                                console.log(`[LOCAL COMPLETENESS] Early return - marking remaining cells as calculation interrupted`);
                                
                                // 確定マス以外は「計算中断」としてマーク
                                this.markRemainingCellsAsInterrupted(group);
                                
                                this.localCompletenessSuccess = 1; // 局所制約完全性成功をマーク
                                return true; // 確定マスが見つかったので早期終了
                            } else {
                                console.log(`[LOCAL COMPLETENESS] No actionable cells found in subset of ${subset.cells.length} cells`);
                            }
                        } else {
                            console.log(`[LOCAL COMPLETENESS] Skipping large subset of ${subset.cells.length} cells (exceeds limit of ${this.maxConstraintSize})`);
                        }
                    }
                    console.log(`[LOCAL COMPLETENESS] All independent subsets processed. No actionable cells found.`);
                } else {
                    console.log(`[LOCAL COMPLETENESS] No independent subsets found in group of ${group.length} cells`);
                }
            } else {
                console.log(`[LOCAL COMPLETENESS] Group too large for local completeness (${group.length} > ${this.maxLocalCompletenessSize} cells). Skipping group.`);
                // グループが大きすぎる場合はスキップ（近似機能は廃止）
            }
        }
        
        // STEP 3: 単純制約パターンの直接計算（一時的にコメントアウト）
        /*
        if (!hasActionableFromPropagation) {
            console.log(`[DEBUG] solveExact called with skipConstraintPropagation: ${skipConstraintPropagation}`);
            console.log(`[DEBUG] Starting simple pattern check...`);
            const simplePatternResult = this.checkSimpleConstraintPatterns(group, constraints);
            if (simplePatternResult) {
                return simplePatternResult.hasActionable;
            }
        }
        */
        
        // STEP 4: 確定していないセルだけを完全探索
        const uncertainIndices = [];
        for (let i = 0; i < group.length; i++) {
            if (!determinedCells.certain.includes(i) && !determinedCells.safe.includes(i)) {
                uncertainIndices.push(i);
            }
        }
        
        if (uncertainIndices.length === 0) {
            // すべて確定した
            return hasActionableFromPropagation; // 制約伝播での結果を返す
        }
        
        
        // 不確定なセルのみで新しいグループと制約を作成
        const uncertainGroup = uncertainIndices.map(i => group[i]);
        const uncertainConstraints = this.adjustConstraintsForUncertain(
            constraints, 
            uncertainIndices, 
            determinedCells.certain
        );
        
        // グループが大きすぎる場合は完全探索をスキップ
        if (uncertainIndices.length > this.maxConstraintSize) {
            console.warn(`Uncertain group too large (${uncertainIndices.length} cells > ${this.maxConstraintSize}). Skipping full search.`);
            
            // 局所制約完全性処理を試行（グループサイズが制限内の場合）
            let hasActionableFromLocal = false;
            if (group.length <= this.maxLocalCompletenessSize) {
                console.log(`[LOCAL COMPLETENESS] Trying local completeness after full search skip for group of ${group.length} cells...`);
                const independentSubsets = this.findIndependentSubsets(group, constraints);
                
                if (independentSubsets.length > 0) {
                    console.log(`[LOCAL COMPLETENESS] Found ${independentSubsets.length} independent subset(s): ${independentSubsets.map(s => s.cells.length + ' cells').join(', ')}`);
                    
                    for (const subset of independentSubsets) {
                        if (subset.cells.length <= this.maxConstraintSize) {
                            const hasActionableFromSubset = this.solveIndependentSubset(subset, group);
                            if (hasActionableFromSubset) {
                                console.log(`[LOCAL COMPLETENESS] Found actionable cells in independent subset of ${subset.cells.length} cells`);
                                hasActionableFromLocal = true;
                                break; // 1つでも確定マスが見つかれば成功
                            }
                        }
                    }
                }
            }
            
            // 局所制約完全性でも確定しなかったセルを-4（完全探索スキップ）としてマーク
            for (const idx of uncertainIndices) {
                if (this.probabilities[group[idx].row][group[idx].col] === -1) {
                    this.probabilities[group[idx].row][group[idx].col] = -4;
                }
            }
            
            // 制約伝播または局所制約完全性で0%/100%が見つかっていればtrueを返す
            return (determinedCells.certain.length > 0 || determinedCells.safe.length > 0 || hasActionableFromLocal);
        }
        
        // 不確定なセルのみで完全探索
        const foundInReducedGroup = this.solveReducedGroup(uncertainGroup, uncertainConstraints, uncertainIndices, group);
        
        // 制約伝播または完全探索で0%/100%が見つかったかを返す
        return (determinedCells.certain.length > 0 || determinedCells.safe.length > 0) || foundInReducedGroup;
    }
    
    // 制約伝播で確定できるセルを見つける
    determineCertainCells(group, constraints) {
        const certain = new Set(); // 100%地雷
        const safe = new Set();    // 0%安全
        let changed = true;
        
        // まず、単純な制約から確定セルを見つける（最初のパス）
        for (const constraint of constraints) {
            // 制約に関わるすべてのセルを確認
            if (constraint.requiredMines === constraint.cells.length) {
                // すべてのセルが地雷
                for (const cellIdx of constraint.cells) {
                    certain.add(cellIdx);
                }
            } else if (constraint.requiredMines === 0) {
                // すべてのセルが安全
                for (const cellIdx of constraint.cells) {
                    safe.add(cellIdx);
                }
            }
        }
        
        // 制約を繰り返し適用して確定セルを見つける
        while (changed) {
            changed = false;
            
            for (const constraint of constraints) {
                const unknownInConstraint = [];
                let minesInConstraint = 0; // 旗は既にrequiredMinesから引かれているので0から開始
                let safesInConstraint = 0;
                
                // この制約に関わるセルの状態を確認
                for (const cellIdx of constraint.cells) {
                    if (certain.has(cellIdx)) {
                        minesInConstraint++;
                    } else if (safe.has(cellIdx)) {
                        safesInConstraint++;
                    } else {
                        unknownInConstraint.push(cellIdx);
                    }
                }
                
                const remainingMines = constraint.requiredMines - minesInConstraint;
                const remainingCells = constraint.cells.length - minesInConstraint - safesInConstraint;
                
                // 制約違反のチェック
                if (remainingMines < 0 || remainingMines > unknownInConstraint.length) {
                    continue;
                }
                
                // すべて地雷の場合
                if (remainingMines === unknownInConstraint.length && unknownInConstraint.length > 0) {
                    for (const idx of unknownInConstraint) {
                        if (!certain.has(idx)) {
                            certain.add(idx);
                            changed = true;
                        }
                    }
                }
                
                // すべて安全の場合
                if (remainingMines === 0 && unknownInConstraint.length > 0) {
                    for (const idx of unknownInConstraint) {
                        if (!safe.has(idx)) {
                            safe.add(idx);
                            changed = true;
                        }
                    }
                }
            }
        }
        
        return {
            certain: Array.from(certain),
            safe: Array.from(safe)
        };
    }
    
    // 不確定セル用に制約を調整
    adjustConstraintsForUncertain(constraints, uncertainIndices, certainMines) {
        const indexMap = new Map();
        for (let i = 0; i < uncertainIndices.length; i++) {
            indexMap.set(uncertainIndices[i], i);
        }
        
        const adjustedConstraints = [];
        
        for (const constraint of constraints) {
            const newCells = [];
            let additionalMines = 0;
            
            for (const cellIdx of constraint.cells) {
                if (indexMap.has(cellIdx)) {
                    newCells.push(indexMap.get(cellIdx));
                } else if (certainMines.includes(cellIdx)) {
                    additionalMines++;
                }
            }
            
            if (newCells.length > 0) {
                adjustedConstraints.push({
                    cells: newCells,
                    requiredMines: constraint.requiredMines - additionalMines,
                    flaggedCount: 0, // 旗は既にrequiredMinesから引かれているので0にする
                    numberCell: constraint.numberCell
                });
            }
        }
        
        return adjustedConstraints;
    }
    
    // 縮小されたグループを完全探索
    solveReducedGroup(uncertainGroup, constraints, originalIndices, fullGroup) {
        const validConfigurations = [];
        const totalConfigs = Math.pow(2, uncertainGroup.length);
        
        // パフォーマンス測定用カウンター更新
        this.totalConfigurations += totalConfigs;
        this.totalExhaustiveSearches += 1;
        this.totalCellsProcessed += uncertainGroup.length;
        
        // すべての可能な配置を試す
        for (let config = 0; config < totalConfigs; config++) {
            
            const mines = [];
            for (let i = 0; i < uncertainGroup.length; i++) {
                if ((config >> i) & 1) {
                    mines.push(i);
                }
            }
            
            if (this.isValidConfiguration(uncertainGroup, mines, constraints)) {
                validConfigurations.push(mines);
            }
        }
        
        // 有効な配置から確率を計算
        let hasActionableCell = false;
        if (validConfigurations.length > 0) {
            for (let i = 0; i < uncertainGroup.length; i++) {
                let mineCount = 0;
                for (const config of validConfigurations) {
                    if (config.includes(i)) {
                        mineCount++;
                    }
                }
                const probability = Math.round((mineCount / validConfigurations.length) * 100);
                const originalIdx = originalIndices[i];
                const row = fullGroup[originalIdx].row;
                const col = fullGroup[originalIdx].col;
                this.probabilities[row][col] = probability;
                
                // 0%または100%の場合は永続的に保存
                if (probability === 0 || probability === 100) {
                    this.persistentProbabilities[row][col] = probability;
                    hasActionableCell = true;
                }
            }
        } else {
            // デフォルト値
            for (let i = 0; i < uncertainGroup.length; i++) {
                const originalIdx = originalIndices[i];
                this.probabilities[fullGroup[originalIdx].row][fullGroup[originalIdx].col] = 50;
            }
        }
        return hasActionableCell;
    }
    
    // 縮小されたグループの最適化版
    // 処理軽減のため一時的にコメントアウト（必要に応じて復活可能）
    /*
    solveReducedGroupOptimized(uncertainGroup, constraints, originalIndices, fullGroup) {
        // 枝刈りを使った深さ優先探索
        const validConfigurations = [];
        const currentConfig = [];
        
        const remainingMines = this.game.mineCount - this.countFlags();
        const certainCount = fullGroup.length - originalIndices.length;
        const maxMinesInUncertain = Math.min(remainingMines, uncertainGroup.length);
        
        // 制約の前処理: 各セルが関わる制約を事前計算
        const cellConstraints = new Array(uncertainGroup.length).fill(null).map(() => []);
        for (let i = 0; i < constraints.length; i++) {
            for (const cellIdx of constraints[i].cells) {
                cellConstraints[cellIdx].push(i);
            }
        }
        
        const dfs = (index, minesUsed) => {
            // 上限チェック
            if (validConfigurations.length > this.maxValidConfigs) {
                console.warn(`Too many valid configurations found (${validConfigurations.length}). Stopping early.`);
                return false;
            }
            
            if (index === uncertainGroup.length) {
                if (this.isValidConfiguration(uncertainGroup, currentConfig, constraints)) {
                    validConfigurations.push([...currentConfig]);
                }
                return true;
            }
            
            // 残り地雷数による枝刈り
            const remainingCells = uncertainGroup.length - index;
            if (minesUsed > maxMinesInUncertain) {
                return true;
            }
            
            // 早期制約チェック
            let canBeEmpty = true;
            let canBeMine = minesUsed < maxMinesInUncertain;
            
            for (const constraintIdx of cellConstraints[index]) {
                const constraint = constraints[constraintIdx];
                const currentMinesInConstraint = currentConfig.filter(i => constraint.cells.includes(i)).length;
                const remainingCellsInConstraint = constraint.cells.filter(i => i > index).length;
                
                // このセルを空にした場合のチェック
                if (currentMinesInConstraint + remainingCellsInConstraint < constraint.requiredMines) {
                    canBeEmpty = false;
                }
                
                // このセルを地雷にした場合のチェック
                if (currentMinesInConstraint + 1 > constraint.requiredMines) {
                    canBeMine = false;
                }
            }
            
            // このセルに地雷を置かない場合
            if (canBeEmpty) {
                dfs(index + 1, minesUsed);
            }
            
            // このセルに地雷を置く場合
            if (canBeMine) {
                currentConfig.push(index);
                dfs(index + 1, minesUsed + 1);
                currentConfig.pop();
            }
            
            return true;
        };
        
        dfs(0, 0);
        
        // 有効な配置から確率を計算
        if (validConfigurations.length > 0) {
            for (let i = 0; i < uncertainGroup.length; i++) {
                let mineCount = 0;
                for (const config of validConfigurations) {
                    if (config.includes(i)) {
                        mineCount++;
                    }
                }
                const probability = Math.round((mineCount / validConfigurations.length) * 100);
                const originalIdx = originalIndices[i];
                const row = fullGroup[originalIdx].row;
                const col = fullGroup[originalIdx].col;
                this.probabilities[row][col] = probability;
                
                // 0%または100%の場合は永続的に保存
                if (probability === 0 || probability === 100) {
                    this.persistentProbabilities[row][col] = probability;
                }
            }
        } else {
            for (let i = 0; i < uncertainGroup.length; i++) {
                const originalIdx = originalIndices[i];
                this.probabilities[fullGroup[originalIdx].row][fullGroup[originalIdx].col] = 50;
            }
        }
    }
    */
    
    // 最適化された完全探索（巨大グループ用）
    // 処理軽減のため一時的にコメントアウト（必要に応じて復活可能）
    /*
    solveExactOptimized(group, constraints) {
        // 枝刈りを使った深さ優先探索
        const validConfigurations = [];
        const currentConfig = [];
        
        const dfs = (index, remainingMinesGlobal) => {
            // 上限チェック（メモリ保護）
            if (validConfigurations.length > this.maxValidConfigs) {
                console.warn(`Too many valid configurations found (${validConfigurations.length}). Stopping early.`);
                return false;
            }
            
            if (index === group.length) {
                // 完全な配置が見つかった
                if (this.isValidConfiguration(group, currentConfig, constraints)) {
                    validConfigurations.push([...currentConfig]);
                }
                return true;
            }
            
            // 残り地雷数による枝刈り
            const remainingCells = group.length - index;
            if (remainingMinesGlobal > remainingCells) {
                return true; // 地雷が多すぎる
            }
            
            // このセルに地雷を置かない場合
            if (this.canPlaceEmpty(group, index, currentConfig, constraints)) {
                dfs(index + 1, remainingMinesGlobal);
            }
            
            // このセルに地雷を置く場合
            if (remainingMinesGlobal > 0 && this.canPlaceMine(group, index, currentConfig, constraints)) {
                currentConfig.push(index);
                dfs(index + 1, remainingMinesGlobal - 1);
                currentConfig.pop();
            }
            
            return true;
        };
        
        const remainingMines = this.game.mineCount - this.countFlags();
        dfs(0, remainingMines);
        
        // 有効な配置から確率を計算
        if (validConfigurations.length > 0) {
            for (let i = 0; i < group.length; i++) {
                let mineCount = 0;
                for (const config of validConfigurations) {
                    if (config.includes(i)) {
                        mineCount++;
                    }
                }
                const probability = (mineCount / validConfigurations.length) * 100;
                this.probabilities[group[i].row][group[i].col] = Math.round(probability);
            }
        } else {
            // デフォルト値
            for (const cell of group) {
                this.probabilities[cell.row][cell.col] = 50;
            }
        }
    }
    */
    
    // 枝刈り用のヘルパー関数
    // 処理軽減のため一時的にコメントアウト（必要に応じて復活可能）
    /*
    canPlaceEmpty(group, index, currentConfig, constraints) {
        // 制約チェック: このセルを空にした場合に制約違反が起きないか
        for (const constraint of constraints) {
            if (!constraint.cells.includes(index)) continue;
            
            const currentMinesInConstraint = currentConfig.filter(i => constraint.cells.includes(i)).length;
            const remainingCellsInConstraint = constraint.cells.filter(i => i > index).length;
            
            // 残りのセルすべてを地雷にしても必要数に足りない場合
            if (currentMinesInConstraint + remainingCellsInConstraint < constraint.requiredMines) {
                return false;
            }
        }
        return true;
    }
    
    canPlaceMine(group, index, currentConfig, constraints) {
        // 簡単な制約チェック
        for (const constraint of constraints) {
            if (constraint.cells.includes(index)) {
                const currentMinesInConstraint = currentConfig.filter(i => constraint.cells.includes(i)).length;
                if (currentMinesInConstraint + 1 > constraint.requiredMines) {
                    return false;
                }
            }
        }
        return true;
    }
    */
    
    // 単一制約の簡単なケースを処理
    trySolveSingleConstraint(group) {
        // 各セルに対して、単一制約で確定できるかチェック
        if (group.length === 0) return null;
        
        const probabilities = new Array(group.length);
        let hasSimpleSolution = false;
        
        // 各数字セルからの制約を個別にチェック
        const numberCells = new Set();
        for (const cell of group) {
            const constraints = this.getConstrainingCells(cell);
            for (const constraint of constraints) {
                numberCells.add(`${constraint.row},${constraint.col},${constraint.value}`);
            }
        }
        
        // 各数字セルについて、その周囲のセルが確定できるかチェック
        for (const numberCellStr of numberCells) {
            const [row, col, value] = numberCellStr.split(',').map(Number);
            const flaggedCount = this.countFlaggedNeighbors(row, col);
            const unknownCount = this.countUnknownNeighbors(row, col);
            const remainingMines = value - flaggedCount;
            
            // この数字セルの周囲のグループ内セルのインデックスを取得
            const affectedIndices = [];
            for (let i = 0; i < group.length; i++) {
                const cell = group[i];
                // セルがこの数字セルに隣接しているかチェック
                if (Math.abs(cell.row - row) <= 1 && Math.abs(cell.col - col) <= 1) {
                    affectedIndices.push(i);
                }
            }
            
            // 確定できる条件をチェック
            if (affectedIndices.length === unknownCount) {
                // この数字セルの周囲の未開示セルがすべてグループ内にある
                if (remainingMines === 0) {
                    // すべて安全
                    for (const idx of affectedIndices) {
                        probabilities[idx] = 0;
                        hasSimpleSolution = true;
                    }
                } else if (remainingMines === unknownCount) {
                    // すべて地雷（100%）
                    for (const idx of affectedIndices) {
                        probabilities[idx] = 100;
                        hasSimpleSolution = true;
                    }
                }
            }
        }
        
        if (hasSimpleSolution) {
            // 未設定のセルはnullのままにする（後で通常の処理で計算）
            return probabilities;
        }
        
        return null;
    }
    
    
    // 配置が制約を満たすかチェック
    isValidConfiguration(group, mineIndices, constraints) {
        // 各制約をチェック
        for (const constraint of constraints) {
            let actualMines = 0;
            
            for (const cellIndex of constraint.cells) {
                if (mineIndices.includes(cellIndex)) {
                    actualMines++;
                }
            }
            
            // 必要な地雷数をチェック（旗の数は既に引かれている）
            if (actualMines !== constraint.requiredMines) {
                return false;
            }
            
            // 必要な地雷数が未開示セル数を超える場合
            const maxPossibleMines = constraint.cells.length;
            if (constraint.requiredMines > maxPossibleMines) {
                return false;
            }
        }
        
        // 残り地雷数の制約もチェック
        const remainingMines = this.game.mineCount - this.countFlags();
        
        if (mineIndices.length > remainingMines) {
            return false;
        }
        
        return true;
    }
    
    // グループの制約を取得
    getConstraintsForGroup(group) {
        const constraints = [];
        const processedCells = new Set();
        const groupCellSet = new Set(group.map(c => `${c.row},${c.col}`));
        
        // グループに影響を与えるすべての数字セルを収集
        const relevantNumberCells = new Set();
        for (const cell of group) {
            const constrainingCells = this.getConstrainingCells(cell);
            for (const constraining of constrainingCells) {
                relevantNumberCells.add(`${constraining.row},${constraining.col},${constraining.value}`);
            }
        }
        
        // 各数字セルから制約を作成
        for (const numberCellStr of relevantNumberCells) {
            const [row, col, value] = numberCellStr.split(',').map(Number);
            
            // この数字セルの周囲の未開示セルを収集（旗も含む）
            const affectedCells = [];
            
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const newRow = row + dr;
                    const newCol = col + dc;
                    
                    if (this.game.isValidCell(newRow, newCol)) {
                        if (!this.game.revealed[newRow][newCol] && !this.game.flagged[newRow][newCol]) {
                            // グループ内のセルかチェック（旗は除く）
                            const cellKey = `${newRow},${newCol}`;
                            if (groupCellSet.has(cellKey)) {
                                const index = group.findIndex(c => c.row === newRow && c.col === newCol);
                                if (index !== -1) {
                                    affectedCells.push(index);
                                }
                            }
                        }
                    }
                }
            }
            
            if (affectedCells.length > 0) {
                const flaggedCount = this.countFlaggedNeighbors(row, col);
                constraints.push({
                    cells: affectedCells,
                    requiredMines: value - flaggedCount, // 旗の数を引いた必要地雷数
                    flaggedCount: flaggedCount,
                    numberCell: { row, col, value }
                });
            }
        }
        
        return constraints;
    }
    
    // 近似計算機能は廃止済み
    
    // 残りのセルのマーキング（制約外としてマーク）
    markRemainingCells(unknownCells, borderCells) {
        // このメソッドは削除または空実装に
        // 実際の処理はcalculateProbabilities内で完了
    }
    
    // 境界セルの地雷数を推定
    estimateBorderMines(borderCells) {
        let estimate = 0;
        for (const cell of borderCells) {
            const prob = this.probabilities[cell.row][cell.col];
            if (prob >= 0) {
                estimate += prob / 100;
            }
        }
        return Math.round(estimate);
    }
    
    // 均等確率を計算（ゲーム開始時など）
    calculateUniformProbabilities(unknownCells) {
        // このメソッドは現在使用されていません
        // 代わりに-2でマークして、全体確率を別途表示
    }
    
    // 旗の数をカウント
    countFlags() {
        let count = 0;
        for (let row = 0; row < this.game.rows; row++) {
            for (let col = 0; col < this.game.cols; col++) {
                if (this.game.flagged[row][col]) {
                    count++;
                }
            }
        }
        return count;
    }
    
    // 未開示の隣接セル数をカウント（旗は除く）
    countUnknownNeighbors(row, col) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newRow = row + dr;
                const newCol = col + dc;
                
                if (this.game.isValidCell(newRow, newCol) &&
                    !this.game.revealed[newRow][newCol] &&
                    !this.game.flagged[newRow][newCol]) {
                    // 旗が立っていないセルのみを未開示として数える
                    count++;
                }
            }
        }
        return count;
    }
    
    // 旗付きの隣接セル数をカウント
    countFlaggedNeighbors(row, col) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newRow = row + dr;
                const newCol = col + dc;
                
                if (this.game.isValidCell(newRow, newCol) &&
                    this.game.flagged[newRow][newCol]) {
                    count++;
                }
            }
        }
        return count;
    }
    
    // 既に盤面上に0%または100%のセルが存在するかチェック
    checkForExistingActionableCells() {
        let foundCells = [];
        for (let row = 0; row < this.game.rows; row++) {
            for (let col = 0; col < this.game.cols; col++) {
                // 未開示かつ旗が立っていないセルのみチェック
                if (!this.game.revealed[row][col] && !this.game.flagged[row][col]) {
                    // 現在の確率のみをチェック（永続確率は見ない）
                    // 永続確率は表示用であり、計算スキップの判定には使わない
                    const prob = this.probabilities[row][col];
                    // 0%または100%のセルが存在する場合
                    if (prob === 0 || prob === 100) {
                        foundCells.push(`(${row},${col}): ${prob}%`);
                    }
                }
            }
        }
        if (foundCells.length > 0) {
            return true;
        }
        return false;
    }
    
    // グループの指紋（fingerprint）を生成
    getGroupFingerprint(group, constraints) {
        // グループのセル座標を文字列化
        const cells = group.map(c => `${c.row},${c.col}`).sort().join('|');
        
        // 制約情報を文字列化（数字マスの位置、値、必要地雷数）
        const constraintInfo = constraints.map(c => {
            const numCell = c.numberCell;
            return `${numCell.row},${numCell.col}:${numCell.value}-${c.requiredMines}`;
        }).sort().join('|');
        
        return `${cells}#${constraintInfo}`;
    }
    
    // 盤面の変更を検出
    detectBoardChanges() {
        if (!this.previousBoardState) {
            // 初回は変更なしとして扱う
            this.saveBoardState();
            return [];
        }
        
        // 盤面サイズが変わった場合（ゲームリセット等）
        if (!this.previousBoardState.revealed || 
            this.previousBoardState.revealed.length !== this.game.rows ||
            (this.previousBoardState.revealed[0] && this.previousBoardState.revealed[0].length !== this.game.cols)) {
            console.log('[DEBUG] Board size changed or reset detected. Clearing all cache.');
            this.saveBoardState();
            return ['reset']; // 特別なフラグとして'reset'を返す
        }
        
        const changes = [];
        for (let row = 0; row < this.game.rows; row++) {
            for (let col = 0; col < this.game.cols; col++) {
                // 開示状態または旗の状態が変わったセルを検出
                if (this.game.revealed[row][col] !== this.previousBoardState.revealed[row][col] ||
                    this.game.flagged[row][col] !== this.previousBoardState.flagged[row][col]) {
                    changes.push({row, col});
                }
            }
        }
        
        // 現在の状態を保存
        this.saveBoardState();
        
        return changes;
    }
    
    // 現在の盤面状態を保存
    saveBoardState() {
        this.previousBoardState = {
            revealed: this.game.revealed.map(row => [...row]),
            flagged: this.game.flagged.map(row => [...row])
        };
    }
    
    // キャッシュの無効化
    invalidateCache(changes) {
        if (changes.length === 0) return;
        
        // リセットの場合は特別な処理
        if (changes[0] === 'reset') {
            const cacheSize = this.groupCache.size;
            if (cacheSize > 0) {
                this.groupCache.clear();
                this.tempGroupCache.clear();
                console.log(`[DEBUG] Game reset detected. Cleared ${cacheSize} cached group results.`);
            }
            return;
        }
        
        // キャッシュを一時保存して、計算中に利用できるようにする
        const cacheSize = this.groupCache.size;
        if (cacheSize > 0) {
            // 現在のキャッシュを一時保存
            this.tempGroupCache = new Map(this.groupCache);
        }
    }
    
    // 近似確率計算機能は廃止済み
    
    // 近似機能関連メソッドは廃止済み
    
    // 近似確率機能は廃止済み
}