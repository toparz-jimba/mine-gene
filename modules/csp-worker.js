// CSPソルバー用WebWorker
// 重い計算処理をバックグラウンドで実行

self.addEventListener('message', function(e) {
    const { type, data } = e.data;
    
    if (type === 'solveGroup') {
        const result = solveConstraintGroup(data);
        self.postMessage({ type: 'solution', result });
    }
});

// 制約グループを解く（WebWorker版）
function solveConstraintGroup({ group, constraints, maxValidConfigs }) {
    const validConfigurations = [];
    const currentConfig = [];
    
    // 制約の前処理
    const cellConstraints = new Array(group.length).fill(null).map(() => []);
    for (let i = 0; i < constraints.length; i++) {
        for (const cellIdx of constraints[i].cells) {
            if (cellIdx < group.length) {
                cellConstraints[cellIdx].push(i);
            }
        }
    }
    
    // 最大地雷数を計算
    let totalRequiredMines = 0;
    const constraintSet = new Set();
    for (const constraint of constraints) {
        constraintSet.add(JSON.stringify(constraint));
    }
    for (const constraintStr of constraintSet) {
        const constraint = JSON.parse(constraintStr);
        totalRequiredMines = Math.max(totalRequiredMines, constraint.requiredMines);
    }
    const maxMinesInGroup = Math.min(totalRequiredMines, group.length);
    
    const dfs = (index, minesUsed) => {
        // 上限チェック
        if (validConfigurations.length > maxValidConfigs) {
            return false;
        }
        
        if (index === group.length) {
            if (isValidConfiguration(currentConfig, constraints)) {
                validConfigurations.push([...currentConfig]);
            }
            return true;
        }
        
        // 残り地雷数による枝刈り
        if (minesUsed > maxMinesInGroup) {
            return true;
        }
        
        // 早期制約チェック
        let canBeEmpty = true;
        let canBeMine = minesUsed < maxMinesInGroup;
        
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
    
    // 確率を計算
    const probabilities = new Array(group.length).fill(0);
    if (validConfigurations.length > 0) {
        for (let i = 0; i < group.length; i++) {
            let mineCount = 0;
            for (const config of validConfigurations) {
                if (config.includes(i)) {
                    mineCount++;
                }
            }
            probabilities[i] = Math.round((mineCount / validConfigurations.length) * 100);
        }
    } else {
        // デフォルト値
        probabilities.fill(50);
    }
    
    return {
        probabilities,
        validConfigCount: validConfigurations.length
    };
}

// 配置が制約を満たすかチェック
function isValidConfiguration(mineIndices, constraints) {
    for (const constraint of constraints) {
        let actualMines = 0;
        
        for (const cellIndex of constraint.cells) {
            if (mineIndices.includes(cellIndex)) {
                actualMines++;
            }
        }
        
        if (actualMines !== constraint.requiredMines) {
            return false;
        }
    }
    
    return true;
}