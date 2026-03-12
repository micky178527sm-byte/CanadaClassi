# CanadaClassi GA4 Event Spec
目的: 運用開始→登録100名のために「計測→改善」を回せるよう、イベント命名と推奨パラメータを統一する。

---

## 0. 基本方針
- GA4はイベントベースで計測する
- PIIは送らない
  - email/name/phone/address/message_body は送信禁止
- 数値は生値より band（帯）を優先
- 同じ意味の項目は必ず同じキー名を使う（city/categoryなど）

---

## 1. 命名規則
### イベント名
- event_ を付与（例: event_sign_up）
- snake_case
- 動詞 + 目的語（sign_up / create_listing / contact_send）

### パラメータ名
- snake_case
- 短く一貫性
- 値は正規化（city は "montreal" のように小文字統一）

---

## 2. パラメータの共通ルール
- city / category は全イベントで共通キーを使用
- entity固有の情報のみ prefix を付ける（例: listing_id, listing_action）
- 検索の文脈は search_* を使用（search_query など）

---

## 3. 共通パラメータ（全イベントで可能な限り付与）
### 必須（推奨）
- page_path: 例 "/post.html"
- page_type: 例 "login" "post" "detail" "chat" "mypage" "static"
- user_status: "logged_in" / "logged_out"
- device_type: "mobile" / "desktop"
- locale: "ja" / "en" / "fr"

### 条件付き（取れる時だけ）
- default_city: ユーザーの登録都市（ログイン後）
- city: 対象の都市（投稿/検索/問い合わせなど文脈がある時）
- category: 対象カテゴリ（文脈がある時）
- experiment_id: ABテスト識別子（例: "signup_copy_v1"）
- consent_version: 同意文バージョン（例: "2026-01-terms-v1"）

---

## 4. 主要イベント一覧（MVP〜運用開始で必須）
### 4-1) 登録完了: event_sign_up（Key event推奨）
発火タイミング
- 登録完了（サーバー成功 or ローカル成功）直後に1回

推奨パラメータ
- signup_method: "email"（将来 "google" 等が増えるなら追加）
- default_city: 登録都市（必須）
- consent_version: 同意文バージョン（必須推奨）

例
- event_name: "event_sign_up"
- params:
  - page_type: "login"
  - signup_method: "email"
  - default_city: "toronto"
  - consent_version: "2026-01-terms-v1"

---

### 4-2) ログイン: event_login
発火タイミング
- ログイン成功直後に1回

推奨パラメータ
- login_method: "email"
- default_city: 取れるなら
- user_type: "temp" / "pr" / "japan_based"（自己申告がある場合のみ）

例
- event_name: "event_login"
- params:
  - page_type: "login"
  - login_method: "email"
  - default_city: "vancouver"

---

### 4-3) 投稿作成完了: event_create_listing（Key event推奨）
発火タイミング
- 投稿の作成/編集/再公開が「成功した」直後に1回

推奨パラメータ
- listing_id: 内部ID（PIIではないID）
- listing_action: "create" / "edit" / "repost"
- category: 例 "jobs" "housing" "market"
- city: 例 "montreal"
- price_band: "0-20" "20-50" "50-100" "100+"
- photo_count: 数値（0,1,2...）
- status: "open" / "closed"

例
- event_name: "event_create_listing"
- params:
  - page_type: "post"
  - listing_id: "12345"
  - listing_action: "create"
  - category: "jobs"
  - city: "toronto"
  - price_band: "100+"
  - photo_count: 3
  - status: "open"

---

### 4-4) 問い合わせ送信完了: event_contact_send（Key event推奨）
発火タイミング
- 問い合わせ送信が成功した直後に1回

推奨パラメータ
- listing_id: 対象投稿ID
- contact_type: "chat" / "form"
- message_length_band: "0-20" "21-80" "81+"
- is_owner: true / false（自分の投稿に送ってないかのチェック）
- category: 対象カテゴリ（取得できる場合）
- city: 対象の都市（取得できる場合）

例
- event_name: "event_contact_send"
- params:
  - page_type: "detail"
  - listing_id: "12345"
  - contact_type: "chat"
  - message_length_band: "21-80"
  - is_owner: false
  - category: "sell"
  - city: "montreal"

---

## 5. 追加イベント（優先度: 中〜低、余力で）
### 5-1) 検索/フィルタ: event_search
目的: どの都市/カテゴリ/キーワードが需要かを見る

推奨パラメータ
- city
- category
- search_query_length_band: "0" "1-3" "4-10" "11+"
- result_count_band: "0" "1-5" "6-20" "21+"

---

### 5-2) 投稿閲覧: event_view_listing
目的: 閲覧→問い合わせのCVRを見る

推奨パラメータ
- listing_id
- category
- city
- from_page_type: "list" "mypage" "search" "external"

---

## 6. Key events（コンバージョン推奨）
- event_sign_up
- event_create_listing
- event_contact_send

---

## 7. 実装注意（必ず守る）
- PIIを送らない（メール/名前/本文/電話など禁止）
- 値は正規化（小文字、表記ゆれ禁止）
- 成功時のみ発火（失敗時は event_error_* を検討）
- 同一操作で二重送信しない（連打対策）

---

## 8. デバッグ手順（開発者向け）
- GA4 Realtimeでイベント確認
- Tag Assistant / DebugViewでパラメータ確認
- 送信されない場合は測定ID、CSP、AdBlock、二重タグを確認

