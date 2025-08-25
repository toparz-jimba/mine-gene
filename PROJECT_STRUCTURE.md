# プロジェクト構造

## ディレクトリ構成

```
mine_web_sumaho/
├── index.html              # ランディングページ（製品選択画面）
├── core/                   # 共通コアモジュール
│   └── minesweeper-core.js # 基底クラス（共通ゲームロジック）
├── products/               # 各製品バージョン
│   ├── simple/            # シンプル版（現在の完成版）
│   │   ├── index.html
│   │   ├── game.js
│   │   └── style.css
│   └── dx/                # DX版（開発予定）
│       └── README.md
├── shared/                 # 共有リソース
│   ├── assets/            # 画像、音声などの共通アセット
│   ├── styles/            # 共通スタイルシート
│   └── utils/             # ユーティリティ関数
├── CLAUDE.md              # Claude Code用の指示書
├── README.md              # プロジェクト概要
└── PROJECT_STRUCTURE.md  # このファイル
```

## 開発方針

### 1. モノレポ構造の採用理由
- **コード共有**: 共通ロジックを`core/`で一元管理
- **保守性**: 全バージョンを同時に更新可能
- **デプロイ**: GitHub Pagesで複数バージョンを簡単にホスティング

### 2. 各ディレクトリの役割

#### `/core`
- すべての派生版で使用する基本的なゲームロジック
- `MinesweeperCore`クラスを提供
- 拡張可能な設計（継承やフックメソッド）

#### `/products`
- 各製品バージョンを独立して管理
- それぞれが独自のHTML/CSS/JSを持つ
- `core`の機能を拡張して使用

#### `/shared`
- アイコン、フォント、音声ファイルなどの共通リソース
- 共通のユーティリティ関数
- テーマやスタイルの共通部分

### 3. 新しい派生版の追加方法

1. `/products`に新しいディレクトリを作成
2. `core/minesweeper-core.js`を継承または利用
3. 独自の機能を追加実装
4. ランディングページ（`index.html`）にリンクを追加

### 4. GitHub Pagesでのデプロイ

```
https://[username].github.io/mine_web_sumaho/              # ランディングページ
https://[username].github.io/mine_web_sumaho/products/simple/  # シンプル版
https://[username].github.io/mine_web_sumaho/products/dx/      # DX版（将来）
```

### 5. ブランチ戦略

- `main`: 本番環境（GitHub Pages）
- `develop`: 開発用ブランチ
- `feature/[製品名]-[機能名]`: 各機能開発用

## 今後の開発予定

### Phase 1: 基盤整備（完了）
- [x] モノレポ構造の構築
- [x] コアモジュールの分離
- [x] シンプル版の移行
- [x] ランディングページの作成

### Phase 2: DX版開発
- [ ] サウンドエフェクトの実装
- [ ] アニメーション効果
- [ ] 統計・ランキング機能
- [ ] セーブ/ロード機能
- [ ] カスタムテーマ

### Phase 3: その他の派生版
- [ ] キッズ版（簡単な難易度、楽しいグラフィック）
- [ ] パズルモード（特殊ルール）
- [ ] バトルモード（対戦機能）
- [ ] 教育版（学習要素）