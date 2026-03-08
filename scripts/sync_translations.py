#!/usr/bin/env python3


import os
import json
import time
import argparse
from typing import Dict, List, Any, Set, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import requests
    from rich.console import Console
    from rich.live import Live
    from rich.table import Table
    from rich.panel import Panel
except ImportError:
    print("Required packages not found. Install with:")
    print("pip install requests rich")
    exit(1)

MESSAGES_DIR = os.path.join(os.path.dirname(__file__), '../frontend/messages')
MARKETING_DIR = os.path.join(MESSAGES_DIR, 'marketing')
REFERENCE_LOCALE = 'en'
# TODO: Configure your target locales
TARGET_LOCALES = ['es', 'de', 'fr', 'pt', 'ja', 'it']

LOCALE_NAMES = {
    'es': 'Spanish',
    'de': 'German',
    'fr': 'French',
    'pt': 'Portuguese (Brazilian)',
    'ja': 'Japanese',
    'it': 'Italian',
}

MAX_RETRIES = 3
RETRY_DELAY = 0
MAX_WORKERS = 20
MAX_KEYS_PER_CHUNK = 25
CONTEXT_KEYS = 2

console = Console()
progress_status = {}


def load_json(filepath: str) -> Dict:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except Exception as e:
        console.print(f"[red]Error loading '{filepath}': {e}[/red]")
        return {}


def save_json(filepath: str, data: Dict, dry_run: bool = False):
    if dry_run:
        console.print(f"[yellow][DRY RUN] Would save to '{filepath}'[/yellow]")
        return

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
    except Exception as e:
        console.print(f"[red]Error saving '{filepath}': {e}[/red]")


def flatten_dict(d: Dict, parent_key: str = '', sep: str = '.') -> Dict:
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def unflatten_dict(d: Dict, sep: str = '.') -> Dict:
    result = {}
    for key, value in d.items():
        parts = key.split(sep)
        current = result
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        current[parts[-1]] = value
    return result


def get_value_by_path(d: Dict, path: str, sep: str = '.') -> Any:
    parts = path.split(sep)
    current = d
    for part in parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    return current


def set_value_by_path(d: Dict, path: str, value: Any, sep: str = '.'):
    parts = path.split(sep)
    current = d
    for part in parts[:-1]:
        if part not in current:
            current[part] = {}
        current = current[part]
    current[parts[-1]] = value


def find_missing_keys(reference_flat: Dict, target_flat: Dict) -> Set[str]:
    return set(reference_flat.keys()) - set(target_flat.keys())


def find_extra_keys(reference_flat: Dict, target_flat: Dict) -> Set[str]:
    return set(target_flat.keys()) - set(reference_flat.keys())


def delete_value_by_path(d: Dict, path: str, sep: str = '.'):
    parts = path.split(sep)
    current = d
    for part in parts[:-1]:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return
    if parts[-1] in current:
        del current[parts[-1]]


def clean_empty_dicts(d: Dict) -> Dict:
    keys_to_delete = []
    for key, value in d.items():
        if isinstance(value, dict):
            clean_empty_dicts(value)
            if not value:
                keys_to_delete.append(key)
    for key in keys_to_delete:
        del d[key]
    return d


def get_keys_with_context(all_keys: List[str], changed_keys: Set[str], context_count: int) -> List[str]:
    if not changed_keys:
        return []

    changed_indices = set()
    for i, key in enumerate(all_keys):
        if key in changed_keys:
            changed_indices.add(i)

    indices_with_context = set()
    for idx in changed_indices:
        start = max(0, idx - context_count)
        end = min(len(all_keys), idx + context_count + 1)
        for i in range(start, end):
            indices_with_context.add(i)

    return [all_keys[i] for i in sorted(indices_with_context)]


def split_into_chunks(keys: List[str], max_keys: int) -> List[List[str]]:
    chunks = []
    current_chunk = []

    for key in keys:
        current_chunk.append(key)
        if len(current_chunk) >= max_keys:
            chunks.append(current_chunk)
            current_chunk = []

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


def build_chunk_translation_prompt(
    chunk_keys: List[str],
    keys_to_translate: Set[str],
    reference_flat: Dict,
    target_flat: Dict,
    target_language: str,
    app_name: str = "the app"
) -> Tuple[str, Dict]:
    content_to_send = {}

    for key in chunk_keys:
        if key in keys_to_translate:
            content_to_send[key] = reference_flat[key]
        elif key in target_flat:
            content_to_send[key] = f"[CONTEXT - DO NOT TRANSLATE] {target_flat[key]}"
        else:
            content_to_send[key] = f"[CONTEXT - DO NOT TRANSLATE] {reference_flat[key]}"

    keys_needing_translation = [k for k in chunk_keys if k in keys_to_translate]

    prompt = f"""Translate English to {target_language} for {app_name}.

KEYS TO TRANSLATE: {len(keys_needing_translation)} keys
CONTEXT KEYS: {len(chunk_keys) - len(keys_needing_translation)} keys (marked with [CONTEXT - DO NOT TRANSLATE])

TRANSLATION RULES:
1. ONLY translate keys that do NOT have "[CONTEXT - DO NOT TRANSLATE]" prefix
2. For context keys, return the text AFTER the prefix as-is (remove the prefix)
3. Keep ALL JSON keys in English exactly as shown
4. Preserve: {{{{variable}}}}, {{count}}, {{amount}}, \\n
5. Use informal "you" forms

KEYS THAT NEED TRANSLATION:
{chr(10).join(f'  - {k}' for k in keys_needing_translation)}

INPUT (translate only non-context keys):
{json.dumps(content_to_send, ensure_ascii=False, indent=2)}

OUTPUT: Return a flat JSON object with ALL keys. Translate the marked keys, keep context keys as-is (without the prefix)."""

    return prompt, keys_needing_translation


GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_MODEL = "gemini-3-flash-preview"


def call_gemini_json(prompt: str, api_key: str, thinking_level: str = "MINIMAL") -> Dict:
    url = f"{GEMINI_API_URL}/{GEMINI_MODEL}:generateContent?key={api_key}"

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 65536,
            "responseMimeType": "application/json",
            "thinkingConfig": {
                "thinkingLevel": thinking_level
            }
        }
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=(10, 120)
            )

            if not response.ok:
                raise Exception(f"API error {response.status_code}: {response.text[:500]}")

            data = response.json()

            candidates = data.get("candidates", [])
            if not candidates:
                raise Exception("No candidates in response")

            parts = candidates[0].get("content", {}).get("parts", [])
            text_part = next((p for p in parts if "text" in p and not p.get("thought")), None)

            if not text_part:
                raise Exception("No text content in response")

            content = text_part["text"].strip()
            return json.loads(content)

        except json.JSONDecodeError as e:
            console.print(f"[yellow]JSON error (attempt {attempt}/{MAX_RETRIES}): {e}[/yellow]")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)
        except requests.exceptions.Timeout as e:
            console.print(f"[yellow]Timeout (attempt {attempt}/{MAX_RETRIES}): {e}[/yellow]")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)
        except Exception as e:
            console.print(f"[yellow]API error (attempt {attempt}/{MAX_RETRIES}): {e}[/yellow]")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)

    console.print(f"[red]All {MAX_RETRIES} attempts failed[/red]")
    return {}


def validate_chunk_translation(keys_to_translate: List[str], translated: Dict) -> Tuple[bool, str]:
    missing = [k for k in keys_to_translate if k not in translated]
    if missing:
        return False, f"Missing keys: {missing[:5]}..."
    return True, "Valid"


def create_progress_table(total_tasks: int) -> Table:
    table = Table(show_header=True, header_style="bold cyan", box=None, expand=True)
    table.add_column("Locale", style="cyan", width=8)
    table.add_column("File", width=20)
    table.add_column("Status", width=12)
    table.add_column("Progress", width=35)

    status_priority = {'processing': 0, 'waiting': 1, 'done': 2, 'error': 3}
    sorted_items = sorted(
        progress_status.items(),
        key=lambda x: (status_priority.get(x[1]['status'], 4), x[0])
    )

    for key, info in sorted_items[:20]:
        status = info['status']
        message = info.get('message', '')

        if status == 'waiting':
            status_text = "[yellow]Wait[/yellow]"
            progress_text = "[dim]Queued[/dim]"
        elif status == 'processing':
            status_text = "[blue]Proc[/blue]"
            progress_text = f"[blue]{message}[/blue]" if message else "[blue]Translating...[/blue]"
        elif status == 'done':
            status_text = "[green]Done[/green]"
            progress_text = f"[green]{message}[/green]" if message else "[green]Completed[/green]"
        elif status == 'error':
            status_text = "[red]Err[/red]"
            progress_text = f"[red]{message}[/red]" if message else "[red]Failed[/red]"
        else:
            status_text = "[dim]Unknown[/dim]"
            progress_text = ""

        parts = key.split('_', 1)
        locale = parts[0]
        file_type = parts[1] if len(parts) > 1 else ''
        table.add_row(locale.upper(), file_type, status_text, progress_text)

    completed = sum(1 for info in progress_status.values() if info['status'] == 'done')
    errors = sum(1 for info in progress_status.values() if info['status'] == 'error')

    table.add_row("", "", "", "", style="dim")
    table.add_row(
        "[bold]Total[/bold]",
        "",
        f"[bold]{completed}/{total_tasks}[/bold]",
        f"[green]{completed} done[/green] • [red]{errors} errors[/red]",
        style="bold"
    )

    return table


def translate_file(
    source_path: str,
    target_path: str,
    target_locale: str,
    file_type: str,
    api_key: str,
    dry_run: bool = False,
    verbose: bool = False
) -> bool:
    task_key = f"{target_locale}_{file_type}"
    progress_status[task_key] = {'status': 'processing', 'message': 'Loading files...'}

    reference_data = load_json(source_path)
    if not reference_data:
        progress_status[task_key] = {'status': 'error', 'message': 'Failed to load reference'}
        return False

    target_data = load_json(target_path)

    reference_flat = flatten_dict(reference_data)
    target_flat = flatten_dict(target_data)

    extra_keys = find_extra_keys(reference_flat, target_flat)
    if extra_keys:
        if verbose:
            console.print(f"[yellow]Removing {len(extra_keys)} extra keys from {target_locale}/{file_type}[/yellow]")
        for key in extra_keys:
            delete_value_by_path(target_data, key)
        clean_empty_dicts(target_data)
        save_json(target_path, target_data, dry_run)
        target_flat = flatten_dict(target_data)

    all_keys = list(reference_flat.keys())
    missing_keys = find_missing_keys(reference_flat, target_flat)

    if not missing_keys:
        progress_status[task_key] = {'status': 'done', 'message': 'Already up to date'}
        return True

    keys_with_context = get_keys_with_context(all_keys, missing_keys, CONTEXT_KEYS)
    chunks = split_into_chunks(keys_with_context, MAX_KEYS_PER_CHUNK)

    progress_status[task_key] = {'status': 'processing', 'message': f'{len(missing_keys)} keys in {len(chunks)} chunks'}

    target_language = LOCALE_NAMES.get(target_locale, target_locale)
    errors = []
    translated_count = 0

    for i, chunk_keys in enumerate(chunks, 1):
        progress_status[task_key] = {'status': 'processing', 'message': f'Chunk {i}/{len(chunks)} ({len(chunk_keys)} keys)'}
        console.print(f"[dim]{target_locale}/{file_type}: chunk {i}/{len(chunks)} ({len(chunk_keys)} keys)...[/dim]")

        keys_in_chunk_to_translate = set(k for k in chunk_keys if k in missing_keys)

        prompt, keys_needing_translation = build_chunk_translation_prompt(
            chunk_keys, keys_in_chunk_to_translate, reference_flat, target_flat, target_language
        )

        translated = call_gemini_json(prompt, api_key)

        if not translated:
            errors.append(f"Chunk {i}: Translation failed after retries")
            if verbose:
                console.print(f"[red]Chunk {i} failed for {target_locale}[/red]")
            continue

        valid, msg = validate_chunk_translation(keys_needing_translation, translated)

        if not valid:
            errors.append(f"Chunk {i}: {msg}")
            if verbose:
                console.print(f"[red]Chunk {i} validation failed for {target_locale}: {msg}[/red]")
            continue

        for key in keys_needing_translation:
            if key in translated:
                value = translated[key]
                if isinstance(value, str) and value.startswith("[CONTEXT - DO NOT TRANSLATE]"):
                    value = value.replace("[CONTEXT - DO NOT TRANSLATE] ", "")
                set_value_by_path(target_data, key, value)
                translated_count += 1

        save_json(target_path, target_data, dry_run)

        if verbose:
            console.print(f"[green]Chunk {i}/{len(chunks)} done for {target_locale} ({len(keys_needing_translation)} keys)[/green]")

    if errors:
        progress_status[task_key] = {'status': 'error', 'message': f'{len(errors)} chunks failed, {translated_count} keys done'}
        return False
    else:
        progress_status[task_key] = {'status': 'done', 'message': f'{translated_count} keys in {len(chunks)} chunks'}
        return True


def get_marketing_files() -> List[str]:
    en_marketing_dir = os.path.join(MARKETING_DIR, REFERENCE_LOCALE)
    if not os.path.isdir(en_marketing_dir):
        return []

    files = []
    for filename in os.listdir(en_marketing_dir):
        if filename.endswith('.json'):
            files.append(filename[:-5])
    return sorted(files)


def main():
    parser = argparse.ArgumentParser(description='Sync translations using Gemini API')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without saving')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show detailed output')
    parser.add_argument('--locales', nargs='+', help='Specific locales to translate (default: all)')
    parser.add_argument('--type', choices=['messages', 'marketing', 'all'], default='all', help='Type of translations to sync')
    parser.add_argument('--file', help='Specific marketing file to sync (e.g., "home", "pricing")')
    args = parser.parse_args()

    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        console.print("[red]Error: GEMINI_API_KEY environment variable is required[/red]")
        console.print("Set it with: export GEMINI_API_KEY='your-api-key'")
        return

    target_locales = args.locales if args.locales else TARGET_LOCALES

    tasks = []

    if args.type in ['messages', 'all']:
        en_messages_path = os.path.join(MESSAGES_DIR, f'{REFERENCE_LOCALE}.json')
        for locale in target_locales:
            target_path = os.path.join(MESSAGES_DIR, f'{locale}.json')
            tasks.append((en_messages_path, target_path, locale, 'messages'))
            progress_status[f"{locale}_messages"] = {'status': 'waiting', 'message': 'Queued'}

    if args.type in ['marketing', 'all']:
        marketing_files = get_marketing_files()

        if args.file:
            if args.file in marketing_files:
                marketing_files = [args.file]
            else:
                console.print(f"[red]Marketing file '{args.file}' not found. Available: {', '.join(marketing_files)}[/red]")
                return

        for marketing_file in marketing_files:
            en_file_path = os.path.join(MARKETING_DIR, REFERENCE_LOCALE, f'{marketing_file}.json')
            for locale in target_locales:
                target_path = os.path.join(MARKETING_DIR, locale, f'{marketing_file}.json')
                file_type = f'mkt/{marketing_file}'
                tasks.append((en_file_path, target_path, locale, file_type))
                progress_status[f"{locale}_{file_type}"] = {'status': 'waiting', 'message': 'Queued'}

    if not tasks:
        console.print("[yellow]No translation tasks to run[/yellow]")
        return

    marketing_files_list = get_marketing_files() if args.type in ['marketing', 'all'] else []

    console.print(Panel.fit(
        f"[bold]Translation Sync[/bold]\n\n"
        f"Locales: {', '.join(target_locales)}\n"
        f"Type: {args.type}\n"
        f"Marketing files: {len(marketing_files_list)} ({', '.join(marketing_files_list[:5])}{'...' if len(marketing_files_list) > 5 else ''})\n"
        f"Tasks: {len(tasks)}\n"
        f"Max keys per chunk: {MAX_KEYS_PER_CHUNK}\n"
        f"Context keys: {CONTEXT_KEYS}\n"
        f"Dry run: {args.dry_run}",
        border_style="blue"
    ))

    if args.verbose:
        for source_path, target_path, locale, file_type in tasks:
            translate_file(source_path, target_path, locale, file_type, api_key, args.dry_run, args.verbose)
    else:
        import threading
        stop_refresh = threading.Event()

        def refresh_display(live, total):
            while not stop_refresh.is_set():
                live.update(create_progress_table(total))
                time.sleep(0.5)

        with Live(create_progress_table(len(tasks)), console=console, refresh_per_second=4) as live:
            refresh_thread = threading.Thread(target=refresh_display, args=(live, len(tasks)))
            refresh_thread.daemon = True
            refresh_thread.start()

            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                futures = [
                    executor.submit(
                        translate_file, source_path, target_path, locale, file_type, api_key, args.dry_run, args.verbose
                    )
                    for source_path, target_path, locale, file_type in tasks
                ]

                for future in as_completed(futures):
                    try:
                        future.result()
                    except Exception as e:
                        console.print(f"[red]Task error: {e}[/red]")

            stop_refresh.set()
            refresh_thread.join(timeout=1)

    completed = sum(1 for info in progress_status.values() if info['status'] == 'done')
    errors = sum(1 for info in progress_status.values() if info['status'] == 'error')

    console.print()
    console.print(Panel.fit(
        f"[bold green]Translation sync completed![/bold green]\n\n"
        f"Total tasks: {len(tasks)}\n"
        f"[green]Completed: {completed}[/green]\n"
        f"[red]Errors: {errors}[/red]",
        border_style="green" if errors == 0 else "yellow"
    ))


if __name__ == "__main__":
    main()
