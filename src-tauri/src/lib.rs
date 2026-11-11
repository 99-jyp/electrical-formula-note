use tauri_plugin_sql::{Migration, MigrationKind};

const SCHEMA_V1: &str = "
CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE formulas (
  id            TEXT PRIMARY KEY,
  category_id   TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  latex         TEXT NOT NULL DEFAULT '',
  expr          TEXT NOT NULL DEFAULT '',
  result_symbol TEXT NOT NULL DEFAULT '',
  result_unit   TEXT NOT NULL DEFAULT '',
  description   TEXT NOT NULL DEFAULT '',
  favorite      INTEGER NOT NULL DEFAULT 0,
  box           INTEGER NOT NULL DEFAULT 1 CHECK (box BETWEEN 1 AND 5),
  due_at        TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX idx_formulas_category ON formulas(category_id);
CREATE INDEX idx_formulas_due ON formulas(due_at);
CREATE TABLE variables (
  formula_id    TEXT NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  symbol        TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  unit          TEXT NOT NULL DEFAULT '',
  default_value REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (formula_id, position)
);
CREATE TABLE tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE formula_tags (
  formula_id TEXT NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  tag_id     INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (formula_id, tag_id)
);
CREATE TABLE reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  formula_id  TEXT NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  correct     INTEGER NOT NULL,
  reviewed_at TEXT NOT NULL
);
";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create_initial_schema",
        sql: SCHEMA_V1,
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:formula_note.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("Tauri 앱 실행 중 오류가 발생했습니다");
}
