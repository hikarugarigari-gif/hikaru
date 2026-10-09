#!/usr/bin/env python3
"""Obsidian vault 内のノート名・エイリアスの言及を [[wikilink]] に置き換える。

使い方:
  python link_mentions.py <vault> --inventory          # ノート一覧を JSON で出力
  python link_mentions.py <vault> --dry-run            # 変更せずに件数だけ報告
  python link_mentions.py <vault> --approve-short AI,UX  # 短い名前のうち承認済みのものも含めて適用

標準ライブラリのみ使用。
"""
import argparse
import datetime
import json
import re
import shutil
import sys
from pathlib import Path

EXCLUDE_DIRS = {".obsidian", ".trash", ".git", ".ingest-backup", ".claude"}
EXCLUDE_FILES = {"CLAUDE.md", "AGENTS.md"}  # Claude への指示ファイルは対象外
READONLY_DIRS = {"raw"}  # 元資料: リンク先にはなるが、中身は書き換えない
SHORT_LEN = 2  # この文字数以下の名前は承認制

# 本文中でリンク化してはいけない範囲
PROTECTED = re.compile(
    r"!?\[\[[^\]]*\]\]"            # 既存の wikilink / 埋め込み
    r"|!?\[[^\]]*\]\([^)]*\)"      # Markdown リンク・画像
    r"|`[^`]*`"                    # インラインコード
    r"|\$[^$\n]+\$"                # インライン数式
    r"|<[^>\n]+>"                  # HTML タグ・自動リンク
    r"|https?://\S+"               # URL
    r"|(?<!\S)#[^\s#]+"            # タグ
)
FENCE = re.compile(r"^\s*(```|~~~)")
HEADING = re.compile(r"^\s{0,3}#{1,6}\s")


def iter_notes(vault: Path):
    for p in sorted(vault.rglob("*.md")):
        parts = p.relative_to(vault).parts
        if p.name not in EXCLUDE_FILES and not any(part in EXCLUDE_DIRS for part in parts):
            yield p


def is_readonly(vault: Path, p: Path):
    return any(part in READONLY_DIRS for part in p.relative_to(vault).parts[:-1])


def split_frontmatter(text: str):
    if text.startswith("---\n"):
        end = text.find("\n---", 4)
        if end != -1:
            nl = text.find("\n", end + 4)
            cut = len(text) if nl == -1 else nl + 1
            return text[:cut], text[cut:]
    return "", text


def parse_aliases(fm: str):
    """frontmatter の aliases / alias を簡易パース（インライン配列・リスト形式の両対応）。"""
    aliases = []
    lines = fm.splitlines()
    for i, line in enumerate(lines):
        m = re.match(r"^(aliases|alias)\s*:\s*(.*)$", line)
        if not m:
            continue
        rest = m.group(2).strip()
        if rest.startswith("["):
            aliases += [a.strip().strip("'\"") for a in rest.strip("[]").split(",")]
        elif rest:
            aliases.append(rest.strip("'\""))
        else:
            for sub in lines[i + 1:]:
                sm = re.match(r"^\s*-\s*(.+)$", sub)
                if not sm:
                    break
                aliases.append(sm.group(1).strip().strip("'\""))
    return [a for a in aliases if a]


def build_index(vault: Path):
    notes, by_name = [], {}
    for p in iter_notes(vault):
        fm, _ = split_frontmatter(p.read_text(encoding="utf-8"))
        note = {"path": str(p.relative_to(vault)), "name": p.stem, "aliases": parse_aliases(fm)}
        notes.append(note)
        by_name.setdefault(p.stem, []).append(note["path"])
    duplicates = {n: ps for n, ps in by_name.items() if len(ps) > 1}
    # 言及の語 -> リンク先ノート名
    terms = {}
    for note in notes:
        if note["name"] in duplicates:
            continue
        for t in [note["name"], *note["aliases"]]:
            if t in terms and terms[t] != note["name"]:
                terms[t] = None  # 複数ノートで同じエイリアス -> 曖昧
            else:
                terms.setdefault(t, note["name"])
    ambiguous_aliases = sorted(t for t, v in terms.items() if v is None)
    terms = {t: v for t, v in terms.items() if v is not None}
    return notes, terms, duplicates, ambiguous_aliases


def term_pattern(term: str):
    esc = re.escape(term)
    # 英数字で始まる/終わる語は英数字に隣接しない場合のみ一致（"AI" が "MAIL" に一致しないように）
    if re.match(r"[A-Za-z0-9]", term):
        esc = r"(?<![A-Za-z0-9])" + esc
    if re.search(r"[A-Za-z0-9]$", term):
        esc = esc + r"(?![A-Za-z0-9])"
    return esc


def link_text(segment, regex, terms_ci, self_name, counter, short_hits):
    def repl(m):
        matched = m.group(0)
        target = terms_ci[matched.lower()]
        if target == self_name:
            return matched
        if len(matched) <= SHORT_LEN and matched not in counter["approved"]:
            short_hits[matched] = short_hits.get(matched, 0) + 1
            return matched
        counter["n"] += 1
        return f"[[{target}]]" if matched == target else f"[[{target}|{matched}]]"
    return regex.sub(repl, segment)


def process_body(body, regex, terms_ci, self_name, counter, short_hits):
    out, in_fence = [], False
    for line in body.splitlines(keepends=True):
        if FENCE.match(line):
            in_fence = not in_fence
            out.append(line)
            continue
        if in_fence or HEADING.match(line):
            out.append(line)
            continue
        pieces, pos = [], 0
        for m in PROTECTED.finditer(line):
            pieces.append(link_text(line[pos:m.start()], regex, terms_ci, self_name, counter, short_hits))
            pieces.append(m.group(0))
            pos = m.end()
        pieces.append(link_text(line[pos:], regex, terms_ci, self_name, counter, short_hits))
        out.append("".join(pieces))
    return "".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("vault")
    ap.add_argument("--inventory", action="store_true", help="ノート一覧を JSON で出力して終了")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--approve-short", default="", help="リンク化を承認した短い語（カンマ区切り）")
    args = ap.parse_args()

    vault = Path(args.vault).expanduser().resolve()
    if not vault.is_dir():
        sys.exit(f"vault が見つかりません: {vault}")
    notes, terms, duplicates, ambiguous_aliases = build_index(vault)

    if args.inventory:
        print(json.dumps({"notes": notes, "duplicate_names": duplicates,
                          "ambiguous_aliases": ambiguous_aliases}, ensure_ascii=False, indent=1))
        return

    # 長い語を優先して一致させる（「有害事象抽出」を「有害事象」より先に）
    ordered = sorted(terms, key=len, reverse=True)
    regex = re.compile("|".join(term_pattern(t) for t in ordered), re.IGNORECASE) if ordered else None
    terms_ci = {t.lower(): v for t, v in terms.items()}
    approved = {s.strip() for s in args.approve_short.split(",") if s.strip()}

    backup_dir = vault / ".ingest-backup" / datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    changed, short_hits = {}, {}
    for p in iter_notes(vault):
        if regex is None:
            break
        if is_readonly(vault, p):
            continue
        text = p.read_text(encoding="utf-8")
        fm, body = split_frontmatter(text)
        counter = {"n": 0, "approved": approved}
        new_body = process_body(body, regex, terms_ci, p.stem, counter, short_hits)
        if counter["n"]:
            rel = p.relative_to(vault)
            changed[str(rel)] = counter["n"]
            if not args.dry_run:
                dest = backup_dir / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(p, dest)
                p.write_text(fm + new_body, encoding="utf-8")

    print(json.dumps({
        "dry_run": args.dry_run,
        "links_added": sum(changed.values()),
        "files_changed": changed,
        "backup": None if args.dry_run or not changed else str(backup_dir.relative_to(vault)),
        "short_terms_pending": short_hits,  # 承認待ち: 語 -> 出現数
        "duplicate_names": duplicates,      # 同名ノートが複数あるためスキップ
        "ambiguous_aliases": ambiguous_aliases,
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
