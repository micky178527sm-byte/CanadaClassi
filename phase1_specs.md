# CanadaClassi Phase 1 Specs

## 目的
運用開始の前提となる「環境/データ定義/計測/CDN/信頼ページ骨格」を確定し、MVPの計測ループを止めない状態にする。

## 成果物（Phase 1）
- ステージング環境（本番と分離、Basic認証またはIP制限）
- 自動バックアップ（毎日）＋手動バックアップ導線
- 復元テスト1回の実施記録
- HivePress前提のデータ設計（ユーザー/投稿フィールド）
- GA4イベント設計と実装方針
- Cloudflareキャッシュ方針の合意（Bypass対象/TTL）
- 信頼ページ（Privacy/Terms/Scam warning）の文面骨格

## 前提
- 本番サイトはカナダリージョンへ配置
- CDN/DNS/WAFはCloudflareを利用
- MVPは最短公開→計測→改善の反復を最優先
- PII（メール/氏名/電話/本文など）はGA4へ送信しない

## 実行順序（推奨）
1) ステージングの用意＋バックアップ/復元テスト
2) データ設計（HivePressフィールド定義）
3) 計測（GA4イベント設計→実装→Realtime確認）
4) Cloudflareキャッシュ設定（機能確認後に適用）
5) 信頼ページ文面の確定・公開導線への反映
6) 最低限QA（登録→投稿→問い合わせ）

## 対象機能（Phase 1）
### 1) ステージング
- 本番と分離されたURL
- Basic認証 or IP制限
- バックアップ運用（自動/手動）
- 復元テストの実施

### 2) データ設計（HivePress前提）
- ユーザー登録時の必須項目: default_city
- 規約/プライバシー同意チェックの必須化
- ListingsのMVP項目: category / city / price / condition / photos(複数) / description / status(受付中/受付終了)

### 3) 計測（GA4）
- event_sign_up / event_login / event_create_listing / event_contact_send の定義
- Realtimeでの動作確認
- 漏斗（訪問→登録→行動）の追跡が可能

### 4) Cloudflare
- /wp-admin/* と /wp-login.php はBypass
- ログインCookieありはBypass
- 画像/CSS/JSはキャッシュ（長めTTL）

### 5) 信頼ページ
- Privacy / Terms / Scam warning の骨格文面
- フッター等から常時アクセス可能

## 定義済みの完了条件（DoD）
- ステージングで復元テストが成功し、手順が記録されている
- HivePressで必須項目が保存/表示できる（最低限: 詳細ページ）
- GA4の4イベントがRealtimeで確認でき、パラメータが想定通り
- Cloudflareキャッシュ方針が適用され、ログイン/投稿/問い合わせで不具合がない
- 信頼ページが公開状態で常時アクセス可能

## 依存関係
- ホスティング事業者のステージング機能 or 追加環境
- WordPress + HivePress の管理画面アクセス
- Cloudflare設定へのアクセス権（APIキー不要でも可）
- GA4測定IDと実装権限

## 工数目安（全体）
- 合計 2.5〜4.5日（環境準備/権限状況により変動）

## 除外（Phase 1ではやらない）
- UI/UXの全面改修
- 収益化や有料プラン設計
- 大規模な初期コンテンツ投入
- 監視/アラートの本格運用

## リスク/保留事項
- Cloudflareのキャッシュ誤設定によるログイン不具合
- HivePressフィールド設計の手戻り
- GA4のデバッグがAdBlock等で阻害される可能性

